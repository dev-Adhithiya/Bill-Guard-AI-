/**
 * @module geminiService
 * @description AI-powered email parsing using Google Gemini.
 * Sends structured extraction prompts to Gemini 2.0 Flash
 * and returns typed bill data objects. Skips low-confidence results.
 */

const { GoogleGenAI } = require('@google/genai');

let ai = null;

/**
 * Initializes the Gemini AI client (lazy singleton).
 * @returns {GoogleGenAI} Initialized AI client
 */
function getClient() {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

/**
 * Builds the structured extraction prompt for a single email.
 * Instructs Gemini to return only valid JSON with specific fields.
 *
 * @param {string} subject - Email subject line
 * @param {string} body - Email body text (first 1500 chars)
 * @returns {string} Complete extraction prompt
 */
function buildPrompt(subject, body) {
  return `You are a financial data extraction engine.
Analyze the following email and extract structured data.

Return ONLY a valid JSON object with these exact fields:
{
  "merchant": "string (company/service name)",
  "amount": "number (in original currency, no symbols)",
  "currency": "string (INR/USD/etc)",
  "type": "string (one of: bill | subscription | receipt | trial | refund | unknown)",
  "dueDate": "string or null (ISO date format YYYY-MM-DD)",
  "billingCycle": "string or null (monthly | yearly | one-time | unknown)",
  "isRecurring": "boolean",
  "confidence": "number (0.0 to 1.0, how confident you are in extraction)"
}

If you cannot extract a field reliably, use null.
Do not include any explanation, only the JSON object.

Email Subject: ${subject}
Email Body: ${body}`;
}

/**
 * Parses a single email using Gemini AI to extract structured bill data.
 * Returns null for low-confidence results (< 0.7) or parse failures.
 *
 * @param {Object} email - Raw email object from gmailService
 * @param {string} email.subject - Email subject
 * @param {string} email.body - Email body (truncated)
 * @param {string} email.messageId - Gmail message ID
 * @returns {Promise<Object|null>} Parsed bill object or null if skipped
 *   { merchant, amount, currency, type, dueDate, billingCycle, isRecurring, confidence }
 */
async function parseEmail(email) {
  try {
    const client = getClient();
    const prompt = buildPrompt(email.subject, email.body);

    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt
    });

    // Extract the text response
    const text = response.text?.trim() || '';

    // Strip potential markdown code fences from Gemini response
    const jsonStr = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(jsonStr);

    // Validate confidence threshold — skip low-confidence extractions
    if (typeof parsed.confidence !== 'number' || parsed.confidence < 0.7) {
      return {
        skipped: true,
        reason: `Low confidence: ${parsed.confidence || 'unknown'}`,
        messageId: email.messageId,
        subject: email.subject,
        sender: email.sender
      };
    }

    return {
      merchant: parsed.merchant || 'Unknown',
      amount: typeof parsed.amount === 'number' ? parsed.amount : 0,
      currency: parsed.currency || 'INR',
      type: parsed.type || 'unknown',
      dueDate: parsed.dueDate || null,
      billingCycle: parsed.billingCycle || null,
      isRecurring: !!parsed.isRecurring,
      confidence: parsed.confidence
    };
  } catch (err) {
    // Parse failure — return skip info for transparency logging
    console.error(`⚠️ Gemini parse failed for ${email.messageId}:`, err.message);
    return {
      skipped: true,
      reason: `Parse error: ${err.message}`,
      messageId: email.messageId,
      subject: email.subject,
      sender: email.sender
    };
  }
}

/**
 * Parses a batch of emails through Gemini, filtering out skipped results.
 * Returns both successful parses and skipped entries for logging.
 *
 * @param {Array<Object>} emails - Array of raw email objects
 * @returns {Promise<{bills: Array, skipped: Array}>}
 */
async function parseEmails(emails) {
  const bills = [];
  const skipped = [];

  for (const email of emails) {
    const result = await parseEmail(email);
    if (!result) continue;

    if (result.skipped) {
      skipped.push(result);
    } else {
      // Attach the original message metadata
      result.messageId = email.messageId;
      result.detectedDate = new Date().toISOString().split('T')[0];
      bills.push(result);
    }
  }

  return { bills, skipped };
}

module.exports = { parseEmail, parseEmails };
