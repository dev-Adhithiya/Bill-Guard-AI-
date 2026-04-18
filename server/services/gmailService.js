/**
 * @module gmailService
 * @description Fetches and filters financial emails from Gmail.
 * Uses a compound OR search query with financial keywords to find
 * invoices, receipts, bills, subscriptions, and charges.
 * Only fetches emails from the last 7 days and deduplicates by message ID.
 */

const { google } = require('googleapis');

/**
 * Financial keyword search filter for Gmail queries.
 * Combines multiple terms with OR logic to catch all bill-related emails.
 */
const FINANCIAL_QUERY = [
  'invoice', 'receipt', 'bill', 'payment confirmation',
  'subscription', 'charged', 'due date', 'trial ending',
  'auto-renewal', 'amount debited'
].map(t => `"${t}"`).join(' OR ');

/**
 * Builds a Gmail search query scoped to the last 7 days.
 * @returns {string} Gmail search query string
 */
function buildQuery() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const after = sevenDaysAgo.toISOString().split('T')[0].replace(/-/g, '/');
  return `(${FINANCIAL_QUERY}) after:${after}`;
}

/**
 * Decodes a base64url-encoded string to UTF-8.
 * @param {string} data - Base64url encoded string
 * @returns {string} Decoded UTF-8 string
 */
function decodeBase64Url(data) {
  if (!data) return '';
  return Buffer.from(data, 'base64url').toString('utf8');
}

/**
 * Extracts the plain text body from a Gmail message payload.
 * Handles both simple and multipart message structures.
 * @param {Object} payload - Gmail message payload object
 * @returns {string} Plain text body (first 1500 chars)
 */
function extractBody(payload) {
  let body = '';

  // Simple message — body is directly in payload
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    body = decodeBase64Url(payload.body.data);
  }

  // Multipart message — search parts for text/plain
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = decodeBase64Url(part.body.data);
        break;
      }
      // Nested multipart (e.g., multipart/alternative inside multipart/mixed)
      if (part.parts) {
        for (const subpart of part.parts) {
          if (subpart.mimeType === 'text/plain' && subpart.body?.data) {
            body = decodeBase64Url(subpart.body.data);
            break;
          }
        }
        if (body) break;
      }
    }
  }

  // Truncate to first 1500 characters for AI parsing efficiency
  return body.substring(0, 1500);
}

/**
 * Extracts a specific header value from a Gmail message.
 * @param {Array} headers - Array of {name, value} header objects
 * @param {string} name - Header name to find (case-insensitive)
 * @returns {string} Header value or empty string
 */
function getHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

/**
 * Fetches financial emails from Gmail for the last 7 days.
 * Returns structured email objects with subject, sender, date, body, and IDs.
 * Uses batch-friendly sequential fetching with minimal API calls.
 *
 * @param {Object} auth - Authenticated Google OAuth2 client
 * @returns {Promise<Array<Object>>} Array of raw email objects:
 *   { messageId, threadId, subject, sender, date, body }
 */
async function fetchFinancialEmails(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const query = buildQuery();

  // Step 1: List message IDs matching financial keywords
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 50 // Cap to avoid quota issues
  });

  const messages = listRes.data.messages || [];
  if (messages.length === 0) return [];

  // Step 2: Fetch full message details for each ID
  // Using sequential fetch to be quota-friendly (no batch API needed)
  const emails = [];
  for (const msg of messages) {
    try {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
        // Only request necessary fields to minimize data transfer
        fields: 'id,threadId,payload(headers,mimeType,body,parts)'
      });

      const headers = detail.data.payload.headers || [];
      emails.push({
        messageId: detail.data.id,
        threadId: detail.data.threadId,
        subject: getHeader(headers, 'Subject'),
        sender: getHeader(headers, 'From'),
        date: getHeader(headers, 'Date'),
        body: extractBody(detail.data.payload)
      });
    } catch (err) {
      // Skip individual message failures silently and continue
      console.error(`⚠️ Failed to fetch message ${msg.id}:`, err.message);
    }
  }

  return emails;
}

module.exports = { fetchFinancialEmails };
