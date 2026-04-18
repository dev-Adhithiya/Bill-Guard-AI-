/**
 * @module alertService
 * @description Alert decision engine and email sender for BillGuard.
 * Evaluates anomalies, deduplicates alerts, composes HTML alert emails,
 * and sends them via the Gmail API.
 */

const { google } = require('googleapis');
const sheetsService = require('./sheetsService');

/**
 * Composes a styled HTML alert email body.
 * Uses inline CSS since Gmail strips <style> tags and external JS.
 *
 * @param {Object} anomaly - Anomaly object from anomalyEngine
 * @param {string} anomaly.type - Alert type (price_hike, duplicate, trial_expiry, forgotten_sub)
 * @param {string} anomaly.merchant - Merchant name
 * @param {number} anomaly.amount - Charge amount
 * @param {string} anomaly.currency - Currency code
 * @param {string} anomaly.message - Human-readable alert message
 * @returns {string} Complete HTML email body
 */
function composeAlertHtml(anomaly) {
  // Color coding by severity
  const colors = {
    price_hike: { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B' },
    duplicate: { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B' },
    trial_expiry: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E' },
    forgotten_sub: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E' }
  };

  const typeLabels = {
    price_hike: '📈 Price Increase Detected',
    duplicate: '⚠️ Possible Duplicate Charge',
    trial_expiry: '⏰ Trial Ending Soon',
    forgotten_sub: '💤 Unused Subscription'
  };

  const c = colors[anomaly.type] || colors.price_hike;
  const label = typeLabels[anomaly.type] || 'Alert';

  const serverUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:24px;">
    <tr>
      <td style="padding-bottom:24px;">
        <span style="font-size:22px;font-weight:700;color:#0F172A;">BillGuard</span>
        <span style="font-size:22px;font-weight:700;color:#10B981;">AI</span>
        <span style="font-size:13px;color:#64748B;display:block;margin-top:2px;">
          Silent financial watchdog
        </span>
      </td>
    </tr>
    <tr>
      <td style="background:${c.bg};border:1px solid ${c.border};border-radius:12px;padding:20px;margin-bottom:16px;">
        <div style="font-size:15px;font-weight:600;color:${c.text};margin-bottom:8px;">
          ${label}
        </div>
        <div style="font-size:14px;color:#334155;line-height:1.5;">
          ${anomaly.message}
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding-top:16px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#64748B;">Merchant</td>
            <td style="padding:4px 0;font-size:13px;color:#0F172A;font-weight:600;text-align:right;">
              ${anomaly.merchant}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#64748B;">Amount</td>
            <td style="padding:4px 0;font-size:13px;color:#0F172A;font-weight:600;text-align:right;">
              ${anomaly.currency} ${anomaly.amount}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:13px;color:#64748B;">Alert Type</td>
            <td style="padding:4px 0;font-size:13px;color:${c.text};font-weight:600;text-align:right;">
              ${anomaly.type.replace(/_/g, ' ').toUpperCase()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding-top:24px;text-align:center;">
        <a href="https://www.google.com/search?q=${encodeURIComponent(anomaly.merchant + ' contact')}"
           style="display:inline-block;background:linear-gradient(135deg,#10B981,#059669);color:white;
           font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;
           margin-right:8px;">
          I'll handle it
        </a>
        <a href="${serverUrl}"
           style="display:inline-block;background:transparent;border:1px solid #E2E8F0;color:#334155;
           font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;
           margin-right:8px;">
          View Dashboard
        </a>
        <a href="${serverUrl}"
           style="display:inline-block;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);
           color:#EF4444;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;
           text-decoration:none;">
          Ignore
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding-top:32px;border-top:1px solid #E2E8F0;margin-top:24px;
          font-size:11px;color:#94A3B8;text-align:center;padding-top:16px;">
        Sent by BillGuard AI • <a href="${serverUrl}" style="color:#94A3B8;">Manage alerts</a>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates the email subject line for an alert.
 * @param {Object} anomaly - Anomaly object
 * @returns {string} Email subject
 */
function getSubject(anomaly) {
  const titles = {
    price_hike: `Price hike from ${anomaly.merchant}`,
    duplicate: `Duplicate charge from ${anomaly.merchant}`,
    trial_expiry: `Trial ending at ${anomaly.merchant}`,
    forgotten_sub: `Unused subscription: ${anomaly.merchant}`
  };
  return `⚠️ BillGuard: ${titles[anomaly.type] || anomaly.merchant}`;
}

/**
 * Sends an alert email via the Gmail API using RFC 2822 format.
 *
 * @param {Object} auth - Google OAuth2 client
 * @param {Object} anomaly - Anomaly object from anomalyEngine
 * @returns {Promise<boolean>} True if sent successfully
 */
async function sendAlert(auth, anomaly) {
  try {
    const gmail = google.gmail({ version: 'v1', auth });

    // Get the authenticated user's email address
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const userEmail = profile.data.emailAddress;

    const subject = getSubject(anomaly);
    const htmlBody = composeAlertHtml(anomaly);

    // Compose RFC 2822 email
    const messageParts = [
      `To: ${userEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      htmlBody
    ];
    const rawMessage = Buffer.from(messageParts.join('\r\n')).toString('base64url');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage }
    });

    // Log alert to Sheets
    await sheetsService.logAlert(auth, {
      alertType: anomaly.type,
      merchant: anomaly.merchant,
      amount: anomaly.amount,
      message: anomaly.message,
      status: 'sent'
    });

    console.log(`📧 Alert sent: ${anomaly.type} — ${anomaly.merchant}`);
    return true;
  } catch (err) {
    console.error(`⚠️ Failed to send alert for ${anomaly.merchant}:`, err.message);

    // Log failed alert
    try {
      await sheetsService.logAlert(auth, {
        alertType: anomaly.type,
        merchant: anomaly.merchant,
        amount: anomaly.amount,
        message: anomaly.message,
        status: `failed: ${err.message}`
      });
    } catch (logErr) {
      console.error('⚠️ Failed to log alert:', logErr.message);
    }

    return false;
  }
}

/**
 * Processes anomalies and sends alerts only for new, non-duplicate ones.
 * Checks the Alerts tab in Sheets to avoid sending duplicate alerts
 * for the same merchant + type combination within the same day.
 *
 * @param {Object} auth - Google OAuth2 client
 * @param {Array<Object>} anomalies - Array of anomaly objects
 * @returns {Promise<{sent: number, skipped: number}>} Alert send stats
 */
async function processAnomalies(auth, anomalies) {
  if (!anomalies || anomalies.length === 0) return { sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;

  // Get existing alerts to deduplicate
  const existingAlerts = await sheetsService.getAllAlerts(auth);
  const today = new Date().toISOString().split('T')[0];

  for (const anomaly of anomalies) {
    // Check if we already sent this type of alert for this merchant today
    const isDuplicate = existingAlerts.some(a =>
      a.alertType === anomaly.type &&
      a.merchant?.toLowerCase() === anomaly.merchant?.toLowerCase() &&
      a.alertDate?.startsWith(today) &&
      a.status === 'sent'
    );

    if (isDuplicate) {
      skipped++;
      continue;
    }

    const success = await sendAlert(auth, anomaly);
    if (success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}

module.exports = { sendAlert, processAnomalies, composeAlertHtml };
