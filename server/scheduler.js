/**
 * @module scheduler
 * @description Node-cron job scheduler for BillGuard background tasks.
 * Sets up three recurring jobs:
 *   1. Email scan — every 6 hours
 *   2. Forgotten subscription check — every Sunday at 9am
 *   3. Monthly PDF digest — 1st of each month at 8am
 */

const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { getAuthClient } = require('./middleware/authMiddleware');

const STATUS_FILE = path.join(__dirname, 'status.json');

/**
 * Writes scan timestamp and metadata to status.json.
 * @param {Object} data - Data to merge into status file
 */
function updateStatus(data) {
  let current = {};
  try {
    if (fs.existsSync(STATUS_FILE)) {
      current = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...current, ...data }, null, 2));
}

/**
 * Initializes all scheduled cron jobs.
 * Jobs only execute if the user is authenticated (tokens exist).
 * All errors are caught and logged without crashing the server.
 */
function initScheduler() {
  console.log('⏰ Initializing scheduler...');

  // ─── Job 1: Email Scan — every 6 hours ────────────────────
  cron.schedule('0 */6 * * *', async () => {
    console.log('🔍 [Scheduled] Starting 6-hour email scan...');
    try {
      const auth = getAuthClient();
      if (!auth) {
        console.log('⏭️ Scan skipped — not authenticated');
        return;
      }

      // Dynamically import to avoid circular dependencies
      const { runScanPipeline } = require('./routes/scan');
      const results = await runScanPipeline(auth);
      updateStatus({ lastScan: new Date().toISOString() });
      console.log(`🔍 [Scheduled] Scan complete: ${results.newBills} bills, ${results.anomalies} anomalies`);
    } catch (err) {
      console.error('🔍 [Scheduled] Scan failed:', err.message);
    }
  });

  // ─── Job 2: Forgotten Subscription Check — every Sunday 9am ─
  cron.schedule('0 9 * * 0', async () => {
    console.log('📊 [Scheduled] Running weekly forgotten subscription check...');
    try {
      const auth = getAuthClient();
      if (!auth) {
        console.log('⏭️ Sub check skipped — not authenticated');
        return;
      }

      const anomalyEngine = require('./services/anomalyEngine');
      const alertService = require('./services/alertService');

      const anomalies = await anomalyEngine.checkForgottenSubscriptions(auth);
      if (anomalies.length > 0) {
        const result = await alertService.processAnomalies(auth, anomalies);
        console.log(`📊 [Scheduled] Found ${anomalies.length} unused subs, sent ${result.sent} alerts`);
      } else {
        console.log('📊 [Scheduled] No forgotten subscriptions found');
      }
    } catch (err) {
      console.error('📊 [Scheduled] Sub check failed:', err.message);
    }
  });

  // ─── Job 3: Monthly PDF Digest — 1st of month at 8am ──────
  cron.schedule('0 8 1 * *', async () => {
    console.log('📄 [Scheduled] Generating monthly digest...');
    try {
      const auth = getAuthClient();
      if (!auth) {
        console.log('⏭️ Digest skipped — not authenticated');
        return;
      }

      const sheetsService = require('./services/sheetsService');
      const pdfService = require('./services/pdfService');
      const driveService = require('./services/driveService');
      const { google } = require('googleapis');

      // Get previous month info
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const month = monthNames[prevMonth.getMonth()];
      const year = prevMonth.getFullYear().toString();

      // Fetch data
      const [allBills, allAlerts] = await Promise.all([
        sheetsService.getAllBills(auth),
        sheetsService.getAllAlerts(auth)
      ]);

      const monthIndex = prevMonth.getMonth();
      const bills = allBills.filter(b => {
        const d = new Date(b.detectedDate);
        return d.getMonth() === monthIndex && d.getFullYear() === parseInt(year);
      });
      const alerts = allAlerts.filter(a => {
        const d = new Date(a.alertDate);
        return d.getMonth() === monthIndex && d.getFullYear() === parseInt(year);
      });
      const anomalies = bills.filter(b => b.anomalyFlag).map(b => ({
        type: b.anomalyFlag.split(',')[0]?.trim(),
        merchant: b.merchant,
        amount: b.amount,
        currency: b.currency || 'INR',
        message: `${b.anomalyFlag} detected for ${b.merchant}`
      }));

      // Generate PDF
      const pdfBuffer = await pdfService.generateDigest({ month, year, bills, alerts, anomalies });
      const fileName = `BillGuard_${month}_${year}.pdf`;
      const driveFile = await driveService.uploadPdf(auth, pdfBuffer, fileName);

      // Send notification
      try {
        const gmail = google.gmail({ version: 'v1', auth });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        const emailBody = `Your ${month} ${year} financial digest is ready in Google Drive.`;
        const message = [
          `To: ${profile.data.emailAddress}`,
          `Subject: 📊 Your ${month} BillGuard Digest is Ready`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=utf-8',
          '',
          emailBody
        ].join('\r\n');

        await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: Buffer.from(message).toString('base64url') }
        });
      } catch (emailErr) {
        console.error('📄 [Scheduled] Digest email failed:', emailErr.message);
      }

      console.log(`📄 [Scheduled] Digest generated: ${fileName}`);
    } catch (err) {
      console.error('📄 [Scheduled] Digest failed:', err.message);
    }
  });

  console.log('⏰ Scheduler initialized — 3 jobs registered');
  console.log('   🔍 Email scan:      every 6 hours');
  console.log('   📊 Sub check:       Sundays at 9am');
  console.log('   📄 Monthly digest:  1st of month at 8am');
}

module.exports = { initScheduler };
