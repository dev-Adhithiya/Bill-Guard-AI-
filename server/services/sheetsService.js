/**
 * @module sheetsService
 * @description Google Sheets CRUD operations for the BillGuard Ledger.
 * Auto-creates the spreadsheet on first run with 4 tabs:
 * Bills, ProcessedIDs, Skipped, Alerts.
 * All bill data, processing logs, and alert history lives here.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join(__dirname, '..', 'status.json');

/**
 * Reads or initializes the local status.json file.
 * Stores spreadsheetId and other runtime metadata.
 * @returns {Object} Status object
 */
function readStatus() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

/**
 * Writes status data to local status.json.
 * @param {Object} data - Status data to persist
 */
function writeStatus(data) {
  const current = readStatus();
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...current, ...data }, null, 2));
}

/**
 * Gets or creates the BillGuard Ledger spreadsheet.
 * On first run, creates the spreadsheet with 4 tabs and header rows.
 * Caches the spreadsheet ID in status.json for subsequent runs.
 *
 * @param {Object} auth - Authenticated Google OAuth2 client
 * @returns {Promise<string>} Spreadsheet ID
 */
async function getOrCreateSpreadsheet(auth) {
  const status = readStatus();
  if (status.spreadsheetId) {
    // Verify the sheet still exists
    try {
      const sheets = google.sheets({ version: 'v4', auth });
      await sheets.spreadsheets.get({ spreadsheetId: status.spreadsheetId });
      return status.spreadsheetId;
    } catch (err) {
      // Sheet was deleted — recreate
      console.log('📊 Saved spreadsheet not found, creating new one...');
    }
  }

  const sheets = google.sheets({ version: 'v4', auth });

  // Create new spreadsheet with 4 tabs
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'BillGuard Ledger' },
      sheets: [
        { properties: { title: 'Bills' } },
        { properties: { title: 'ProcessedIDs' } },
        { properties: { title: 'Skipped' } },
        { properties: { title: 'Alerts' } }
      ]
    }
  });

  const spreadsheetId = res.data.spreadsheetId;

  // Add header rows to each tab
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        {
          range: 'Bills!A1:K1',
          values: [['messageId', 'merchant', 'amount', 'currency', 'type',
            'dueDate', 'billingCycle', 'isRecurring', 'detectedDate',
            'anomalyFlag', 'alertSent']]
        },
        {
          range: 'ProcessedIDs!A1',
          values: [['messageId']]
        },
        {
          range: 'Skipped!A1:E1',
          values: [['messageId', 'subject', 'sender', 'reason', 'date']]
        },
        {
          range: 'Alerts!A1:F1',
          values: [['alertDate', 'alertType', 'merchant', 'amount', 'message', 'status']]
        }
      ]
    }
  });

  // Cache the spreadsheet ID
  writeStatus({ spreadsheetId });
  console.log(`📊 BillGuard Ledger created: ${spreadsheetId}`);
  return spreadsheetId;
}

/**
 * Appends a parsed bill record to the Bills tab.
 * @param {Object} auth - Google OAuth2 client
 * @param {Object} bill - Parsed bill object from geminiService
 */
async function appendBill(auth, bill) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = await getOrCreateSpreadsheet(auth);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Bills!A:K',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        bill.messageId,
        bill.merchant,
        bill.amount,
        bill.currency,
        bill.type,
        bill.dueDate || '',
        bill.billingCycle || '',
        bill.isRecurring ? 'TRUE' : 'FALSE',
        bill.detectedDate,
        bill.anomalyFlag || '',
        bill.alertSent ? 'TRUE' : 'FALSE'
      ]]
    }
  });
}

/**
 * Fetches all bill history for a specific merchant.
 * @param {Object} auth - Google OAuth2 client
 * @param {string} merchant - Merchant name to search for
 * @returns {Promise<Array<Object>>} Array of bill records for the merchant
 */
async function getBillHistory(auth, merchant) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = await getOrCreateSpreadsheet(auth);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Bills!A:K'
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return []; // Only header row

  const headers = rows[0];
  return rows.slice(1)
    .filter(row => row[1]?.toLowerCase() === merchant.toLowerCase())
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });
}

/**
 * Checks if a message ID has already been processed.
 * Uses an in-memory cache and falls back to Sheets lookup.
 * @param {Object} auth - Google OAuth2 client
 * @param {string} messageId - Gmail message ID
 * @returns {Promise<boolean>}
 */
async function isProcessed(auth, messageId) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = await getOrCreateSpreadsheet(auth);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'ProcessedIDs!A:A'
  });

  const ids = (res.data.values || []).flat();
  return ids.includes(messageId);
}

/**
 * Marks a message ID as processed by appending to ProcessedIDs tab.
 * @param {Object} auth - Google OAuth2 client
 * @param {string} messageId - Gmail message ID
 */
async function markProcessed(auth, messageId) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = await getOrCreateSpreadsheet(auth);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'ProcessedIDs!A:A',
    valueInputOption: 'RAW',
    requestBody: { values: [[messageId]] }
  });
}

/**
 * Logs a skipped email to the Skipped tab for transparency.
 * @param {Object} auth - Google OAuth2 client
 * @param {Object} entry - Skipped email info { messageId, subject, sender, reason }
 */
async function logSkipped(auth, entry) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = await getOrCreateSpreadsheet(auth);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Skipped!A:E',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        entry.messageId,
        entry.subject || '',
        entry.sender || '',
        entry.reason || '',
        new Date().toISOString().split('T')[0]
      ]]
    }
  });
}

/**
 * Logs an alert record to the Alerts tab.
 * @param {Object} auth - Google OAuth2 client
 * @param {Object} alert - Alert object { alertType, merchant, amount, message, status }
 */
async function logAlert(auth, alert) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = await getOrCreateSpreadsheet(auth);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Alerts!A:F',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        new Date().toISOString(),
        alert.alertType,
        alert.merchant,
        alert.amount,
        alert.message,
        alert.status || 'sent'
      ]]
    }
  });
}

/**
 * Returns all bill rows from the Bills tab for the dashboard.
 * @param {Object} auth - Google OAuth2 client
 * @returns {Promise<Array<Object>>} Array of all bill objects
 */
async function getAllBills(auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = await getOrCreateSpreadsheet(auth);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Bills!A:K'
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

/**
 * Returns all alert rows from the Alerts tab.
 * @param {Object} auth - Google OAuth2 client
 * @returns {Promise<Array<Object>>} Array of alert objects
 */
async function getAllAlerts(auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = await getOrCreateSpreadsheet(auth);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Alerts!A:F'
  });

  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

/**
 * Returns the spreadsheet URL for the UI.
 * @param {Object} auth - Google OAuth2 client
 * @returns {Promise<string>} Spreadsheet URL
 */
async function getSpreadsheetUrl(auth) {
  const id = await getOrCreateSpreadsheet(auth);
  return `https://docs.google.com/spreadsheets/d/${id}`;
}

module.exports = {
  getOrCreateSpreadsheet,
  appendBill,
  getBillHistory,
  isProcessed,
  markProcessed,
  logSkipped,
  logAlert,
  getAllBills,
  getAllAlerts,
  getSpreadsheetUrl
};
