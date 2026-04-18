/**
 * @module authMiddleware
 * @description Verifies that requests have a valid authenticated session.
 * Checks for stored tokens and refreshes if expired.
 * Attaches the authenticated OAuth2 client to req.auth.
 */

const { google } = require('googleapis');
const tokenStore = require('../tokenStore');

/**
 * Creates a configured Google OAuth2 client with stored credentials.
 * Automatically refreshes expired tokens.
 *
 * @returns {Object|null} Configured OAuth2 client or null if no tokens
 */
function getAuthClient() {
  const tokens = tokenStore.loadTokens();
  if (!tokens) return null;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials(tokens);

  // Auto-refresh on token expiry
  oauth2Client.on('tokens', (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    tokenStore.saveTokens(merged);
    console.log('🔄 OAuth tokens refreshed');
  });

  return oauth2Client;
}

/**
 * Express middleware that verifies authentication.
 * Attaches auth client to req.auth for downstream route handlers.
 * Returns 401 if not authenticated.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function requireAuth(req, res, next) {
  const auth = getAuthClient();
  if (!auth) {
    return res.status(401).json({
      error: 'Not authenticated',
      message: 'Please log in with Google to continue.'
    });
  }
  req.auth = auth;
  next();
}

module.exports = { requireAuth, getAuthClient };
