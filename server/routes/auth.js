/**
 * @module routes/auth
 * @description Google OAuth 2.0 authentication routes.
 * Handles login initiation, OAuth callback, logout, and status checks.
 *
 * Routes:
 *   GET  /auth/google   — Redirect to Google OAuth consent screen
 *   GET  /auth/callback  — Handle OAuth callback, store tokens
 *   POST /auth/logout    — Clear stored tokens
 *   GET  /auth/status    — Check if user is authenticated
 */

const express = require('express');
const { google } = require('googleapis');
const tokenStore = require('../tokenStore');

const router = express.Router();

// Required OAuth scopes for all BillGuard features
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

/**
 * Creates a new OAuth2 client instance.
 * @returns {Object} Google OAuth2 client
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * GET /auth/google
 * Generates the OAuth consent URL and redirects the user to Google.
 * Requests offline access to get a refresh token for background scans.
 */
router.get('/google', (req, res) => {
  const oauth2Client = createOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent to ensure refresh token is returned
  });

  res.redirect(authUrl);
});

/**
 * GET /auth/callback
 * Handles the OAuth callback from Google. Exchanges the auth code for
 * tokens, stores them encrypted, and redirects to the frontend.
 */
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=no_code`);
  }

  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user profile info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Store tokens encrypted
    tokenStore.saveTokens({
      ...tokens,
      email: userInfo.data.email,
      name: userInfo.data.name,
      picture: userInfo.data.picture
    });

    console.log(`✅ Authenticated: ${userInfo.data.email}`);

    // Redirect to frontend setup wizard
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/?setup=true`);
  } catch (err) {
    console.error('⚠️ OAuth callback error:', err.message);
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=auth_failed`);
  }
});

/**
 * POST /auth/logout
 * Clears stored tokens and ends the user's session.
 */
router.post('/logout', (req, res) => {
  tokenStore.clearTokens();
  console.log('🔓 User logged out');
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /auth/status
 * Returns the current authentication status and user info.
 * Does not require auth middleware — used by frontend to check login state.
 */
router.get('/status', (req, res) => {
  const tokens = tokenStore.loadTokens();
  if (!tokens) {
    return res.json({ authenticated: false });
  }

  res.json({
    authenticated: true,
    user: {
      email: tokens.email || null,
      name: tokens.name || null,
      picture: tokens.picture || null
    }
  });
});

module.exports = router;
