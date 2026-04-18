/**
 * @module routes/scan
 * @description Scan routes for manual and automated email scanning.
 * Orchestrates the full scan pipeline: fetch emails → parse with AI →
 * check for anomalies → store in Sheets → send alerts.
 *
 * Routes:
 *   POST /scan/run    — Trigger a manual scan
 *   GET  /scan/status — Get last scan time and next scan countdown
 */

const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const gmailService = require('../services/gmailService');
const geminiService = require('../services/geminiService');
const sheetsService = require('../services/sheetsService');
const anomalyEngine = require('../services/anomalyEngine');
const alertService = require('../services/alertService');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const STATUS_FILE = path.join(__dirname, '..', 'status.json');

/**
 * Reads the local status.json for scan timing info.
 * @returns {Object} Status data
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
 * Writes to status.json (merges with existing data).
 * @param {Object} data - Data to merge into status
 */
function writeStatus(data) {
  const current = readStatus();
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...current, ...data }, null, 2));
}

/**
 * Runs the full scan pipeline.
 * This is the core orchestration function used by both manual
 * triggers and the scheduled cron job.
 *
 * Pipeline: Gmail fetch → AI parse → dedup → anomaly check → store → alert
 *
 * @param {Object} auth - Authenticated Google OAuth2 client
 * @returns {Promise<Object>} Scan results summary
 */
async function runScanPipeline(auth) {
  console.log('🔍 Starting email scan...');
  const startTime = Date.now();

  // Step 1: Fetch financial emails from Gmail
  const rawEmails = await gmailService.fetchFinancialEmails(auth);
  console.log(`📩 Found ${rawEmails.length} financial emails`);

  if (rawEmails.length === 0) {
    writeStatus({ lastScan: new Date().toISOString() });
    return {
      emailsFound: 0, newBills: 0, skipped: 0,
      anomalies: 0, alertsSent: 0,
      duration: Date.now() - startTime
    };
  }

  // Step 2: Deduplicate — skip already processed emails
  const newEmails = [];
  for (const email of rawEmails) {
    const processed = await sheetsService.isProcessed(auth, email.messageId);
    if (!processed) newEmails.push(email);
  }
  console.log(`🆕 ${newEmails.length} new emails to process`);

  // Step 3: Parse with Gemini AI
  const { bills, skipped } = await geminiService.parseEmails(newEmails);
  console.log(`🤖 Parsed ${bills.length} bills, skipped ${skipped.length}`);

  // Step 4: Log skipped emails for transparency
  for (const skip of skipped) {
    await sheetsService.logSkipped(auth, skip);
    await sheetsService.markProcessed(auth, skip.messageId);
  }

  // Step 5: Process each bill — anomaly check + store + alert
  let totalAnomalies = 0;
  let totalAlertsSent = 0;

  for (const bill of bills) {
    // Run anomaly detection checks (1-3)
    const anomalies = await anomalyEngine.runChecks(auth, bill);

    if (anomalies.length > 0) {
      bill.anomalyFlag = anomalies.map(a => a.type).join(', ');
      totalAnomalies += anomalies.length;

      // Send alerts for detected anomalies
      const alertResult = await alertService.processAnomalies(auth, anomalies);
      totalAlertsSent += alertResult.sent;
      bill.alertSent = alertResult.sent > 0;
    }

    // Store bill in Sheets
    await sheetsService.appendBill(auth, bill);
    await sheetsService.markProcessed(auth, bill.messageId);
  }

  // Update scan timestamp
  writeStatus({ lastScan: new Date().toISOString() });

  const results = {
    emailsFound: rawEmails.length,
    newBills: bills.length,
    skipped: skipped.length,
    anomalies: totalAnomalies,
    alertsSent: totalAlertsSent,
    duration: Date.now() - startTime
  };

  console.log(`✅ Scan complete in ${results.duration}ms — ${results.newBills} bills, ${results.anomalies} anomalies`);
  return results;
}

/**
 * POST /scan/run
 * Triggers a manual email scan. Requires authentication.
 * Runs the full scan pipeline and returns results.
 */
router.post('/run', requireAuth, async (req, res) => {
  try {
    const results = await runScanPipeline(req.auth);
    res.json({ success: true, results });
  } catch (err) {
    console.error('⚠️ Scan failed:', err.message);

    // Provide specific error messages for common Google API errors
    if (err.message?.includes('invalid_grant')) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your Google session has expired. Please log in again.'
      });
    }
    if (err.message?.includes('quota')) {
      return res.status(429).json({
        error: 'Quota exceeded',
        message: 'Google API quota exceeded. Try again later.'
      });
    }
    if (err.message?.includes('insufficient')) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Missing required Google permissions. Please re-authorize.'
      });
    }

    res.status(500).json({
      error: 'Scan failed',
      message: err.message
    });
  }
});

/**
 * GET /scan/status
 * Returns the last scan timestamp and calculates time until next scan.
 */
router.get('/status', (req, res) => {
  const status = readStatus();
  const lastScan = status.lastScan ? new Date(status.lastScan) : null;

  let nextScan = null;
  if (lastScan) {
    nextScan = new Date(lastScan.getTime() + 6 * 60 * 60 * 1000); // 6 hours later
  }

  res.json({
    lastScan: lastScan?.toISOString() || null,
    nextScan: nextScan?.toISOString() || null,
    spreadsheetId: status.spreadsheetId || null
  });
});

// Export both the router and the pipeline function (used by scheduler)
module.exports = router;
module.exports.runScanPipeline = runScanPipeline;
