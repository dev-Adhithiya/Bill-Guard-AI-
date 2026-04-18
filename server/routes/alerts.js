/**
 * @module routes/alerts
 * @description Alert history and management routes.
 * Provides endpoints to fetch recent alerts, dismiss, and snooze them.
 *
 * Routes:
 *   GET  /alerts/recent      — Get recent alerts (last 20)
 *   GET  /alerts/stats        — Get alert statistics for dashboard
 *   POST /alerts/dismiss/:id  — Mark an alert as dismissed
 *   POST /alerts/snooze/:id   — Snooze an alert for 24 hours
 */

const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const sheetsService = require('../services/sheetsService');

const router = express.Router();

/**
 * GET /alerts/recent
 * Returns the most recent alerts (up to 20) from the Alerts tab.
 * Results are sorted by date descending (newest first).
 */
router.get('/recent', requireAuth, async (req, res) => {
  try {
    const alerts = await sheetsService.getAllAlerts(req.auth);

    // Sort by date descending and limit to 20
    const sorted = alerts
      .sort((a, b) => new Date(b.alertDate) - new Date(a.alertDate))
      .slice(0, 20);

    res.json({ success: true, alerts: sorted });
  } catch (err) {
    console.error('⚠️ Failed to fetch alerts:', err.message);
    res.status(500).json({ error: 'Failed to fetch alerts', message: err.message });
  }
});

/**
 * GET /alerts/stats
 * Returns aggregated alert statistics for the dashboard stat cards.
 * Computes: total alerts, anomalies by type, money protected.
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const [alerts, bills] = await Promise.all([
      sheetsService.getAllAlerts(req.auth),
      sheetsService.getAllBills(req.auth)
    ]);

    const totalAlerts = alerts.filter(a => a.status === 'sent').length;
    const anomalies = bills.filter(b => b.anomalyFlag).length;

    // Money protected = sum of amounts where anomaly was flagged
    // (price hikes + duplicates that the user was warned about)
    const moneyProtected = bills
      .filter(b => b.anomalyFlag && (b.anomalyFlag.includes('price_hike') || b.anomalyFlag.includes('duplicate')))
      .reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);

    res.json({
      success: true,
      stats: {
        totalBills: bills.length,
        totalAlerts,
        anomalies,
        moneyProtected: Math.round(moneyProtected)
      }
    });
  } catch (err) {
    console.error('⚠️ Failed to fetch stats:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats', message: err.message });
  }
});

/**
 * POST /alerts/dismiss/:id
 * Marks an alert as dismissed. The id is the alert's row index.
 * (In a production app, this would update the row in Sheets.)
 */
router.post('/dismiss/:id', requireAuth, async (req, res) => {
  try {
    // For hackathon scope, log the dismissal as a new entry
    await sheetsService.logAlert(req.auth, {
      alertType: 'dismiss',
      merchant: req.params.id,
      amount: 0,
      message: `Alert ${req.params.id} dismissed by user`,
      status: 'dismissed'
    });

    res.json({ success: true, message: 'Alert dismissed' });
  } catch (err) {
    console.error('⚠️ Dismiss failed:', err.message);
    res.status(500).json({ error: 'Failed to dismiss', message: err.message });
  }
});

/**
 * POST /alerts/snooze/:id
 * Snoozes an alert for 24 hours by logging a snooze entry.
 */
router.post('/snooze/:id', requireAuth, async (req, res) => {
  try {
    await sheetsService.logAlert(req.auth, {
      alertType: 'snooze',
      merchant: req.params.id,
      amount: 0,
      message: `Alert ${req.params.id} snoozed for 24 hours`,
      status: 'snoozed'
    });

    res.json({ success: true, message: 'Alert snoozed for 24 hours' });
  } catch (err) {
    console.error('⚠️ Snooze failed:', err.message);
    res.status(500).json({ error: 'Failed to snooze', message: err.message });
  }
});

module.exports = router;
