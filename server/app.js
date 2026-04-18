/**
 * @module app
 * @description Express application entry point for BillGuard AI.
 * Configures all middleware, mounts routes, and starts the server.
 * Initializes the cron scheduler for background scanning.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimiter = require('./middleware/rateLimiter');
const { initScheduler } = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security Middleware ──────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(rateLimiter);

// ─── Body Parsing ─────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check (no auth required) ──────────────────────────
app.get('/health', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  let status = {};
  try {
    const statusFile = path.join(__dirname, 'status.json');
    if (fs.existsSync(statusFile)) {
      status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    }
  } catch (e) { /* ignore */ }

  res.json({
    status: 'ok',
    service: 'BillGuard AI',
    uptime: process.uptime(),
    lastScan: status.lastScan || null,
    timestamp: new Date().toISOString()
  });
});

// ─── API Routes ───────────────────────────────────────────────
app.use('/auth', require('./routes/auth'));
app.use('/scan', require('./routes/scan'));
app.use('/alerts', require('./routes/alerts'));
app.use('/digest', require('./routes/digest'));

// ─── Production Deployment (Frontend Serving) ───────────────────
if (process.env.NODE_ENV === 'production' || process.env.SERVE_FRONTEND === 'true') {
  const path = require('path');
  const clientDist = path.join(__dirname, '../client/dist');
  
  // Serve static assets
  app.use(express.static(clientDist));

  // Catch-all route for SPA navigation
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ─── Bills endpoint (proxy to sheetsService for frontend) ─────
const { requireAuth } = require('./middleware/authMiddleware');
const sheetsService = require('./services/sheetsService');

/**
 * GET /bills
 * Returns all bills from the Google Sheets ledger.
 */
app.get('/bills', requireAuth, async (req, res) => {
  try {
    const bills = await sheetsService.getAllBills(req.auth);
    res.json({ success: true, bills });
  } catch (err) {
    console.error('⚠️ Failed to fetch bills:', err.message);
    res.status(500).json({ error: 'Failed to fetch bills', message: err.message });
  }
});

/**
 * GET /sheets/url
 * Returns the URL of the BillGuard Ledger spreadsheet.
 */
app.get('/sheets/url', requireAuth, async (req, res) => {
  try {
    const url = await sheetsService.getSpreadsheetUrl(req.auth);
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get sheet URL', message: err.message });
  }
});

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// ─── Error Handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   🛡️  BillGuard AI Server Running     ║');
  console.log(`║   📡 http://localhost:${PORT}             ║`);
  console.log('║   🏥 /health for status               ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('');

  // Initialize background scheduler
  initScheduler();
});

module.exports = app;
