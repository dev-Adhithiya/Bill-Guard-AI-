/**
 * @module routes/digest
 * @description Monthly PDF digest generation and delivery routes.
 * Generates a financial summary PDF, uploads to Google Drive,
 * and sends an email notification.
 *
 * Routes:
 *   POST /digest/generate — Generate and upload the monthly digest
 */

const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const sheetsService = require('../services/sheetsService');
const pdfService = require('../services/pdfService');
const driveService = require('../services/driveService');
const alertService = require('../services/alertService');

const router = express.Router();

/**
 * POST /digest/generate
 * Generates the monthly PDF digest, uploads it to Google Drive,
 * and sends an email notification to the user.
 *
 * Query params:
 *   month (optional) — Month name (defaults to previous month)
 *   year  (optional) — Year (defaults to current year)
 */
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    // Default to previous month
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const month = req.query.month || monthNames[prevMonth.getMonth()];
    const year = req.query.year || prevMonth.getFullYear().toString();

    console.log(`📄 Generating digest for ${month} ${year}...`);

    // Fetch all bills and alerts
    const [allBills, allAlerts] = await Promise.all([
      sheetsService.getAllBills(req.auth),
      sheetsService.getAllAlerts(req.auth)
    ]);

    // Filter to the target month
    const monthIndex = monthNames.indexOf(month);
    const bills = allBills.filter(b => {
      const d = new Date(b.detectedDate);
      return d.getMonth() === monthIndex && d.getFullYear() === parseInt(year);
    });

    const alerts = allAlerts.filter(a => {
      const d = new Date(a.alertDate);
      return d.getMonth() === monthIndex && d.getFullYear() === parseInt(year);
    });

    // Build anomaly list from flagged bills
    const anomalies = bills
      .filter(b => b.anomalyFlag)
      .map(b => ({
        type: b.anomalyFlag.split(',')[0]?.trim() || 'unknown',
        merchant: b.merchant,
        amount: b.amount,
        currency: b.currency || 'INR',
        message: `${b.anomalyFlag} detected for ${b.merchant} — ${b.currency || 'INR'} ${b.amount}`
      }));

    // Generate PDF
    const pdfBuffer = await pdfService.generateDigest({
      month, year, bills, alerts, anomalies
    });

    // Upload to Google Drive
    const fileName = `BillGuard_${month}_${year}.pdf`;
    const driveFile = await driveService.uploadPdf(req.auth, pdfBuffer, fileName);

    // Send notification email
    try {
      const { google } = require('googleapis');
      const gmail = google.gmail({ version: 'v1', auth: req.auth });
      const profile = await gmail.users.getProfile({ userId: 'me' });
      const userEmail = profile.data.emailAddress;

      const emailBody = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <div style="font-size:20px;font-weight:700;color:#0F172A;">
            BillGuard<span style="color:#10B981;">AI</span>
          </div>
          <p style="font-size:14px;color:#334155;margin-top:16px;">
            Your ${month} ${year} financial digest is ready in Google Drive.
          </p>
          <a href="${driveFile.webViewLink || '#'}"
             style="display:inline-block;margin-top:16px;background:linear-gradient(135deg,#10B981,#059669);
             color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">
            View Digest
          </a>
          <p style="font-size:11px;color:#94A3B8;margin-top:24px;">
            Sent by BillGuard AI
          </p>
        </div>
      `;

      const message = [
        `To: ${userEmail}`,
        `Subject: 📊 Your ${month} BillGuard Digest is Ready`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        emailBody
      ].join('\r\n');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: Buffer.from(message).toString('base64url') }
      });
    } catch (emailErr) {
      // Digest was generated — email notification failure is non-critical
      console.error('⚠️ Digest email notification failed:', emailErr.message);
    }

    res.json({
      success: true,
      digest: {
        month,
        year,
        totalBills: bills.length,
        totalAlerts: alerts.length,
        anomalies: anomalies.length,
        driveLink: driveFile.webViewLink || null,
        fileName
      }
    });
  } catch (err) {
    console.error('⚠️ Digest generation failed:', err.message);
    res.status(500).json({ error: 'Digest generation failed', message: err.message });
  }
});

module.exports = router;
