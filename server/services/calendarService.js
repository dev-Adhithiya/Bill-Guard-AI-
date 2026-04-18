/**
 * @module calendarService
 * @description Checks Google Calendar for subscription usage signals.
 * Searches calendar events for merchant names to determine if a
 * subscription is being actively used. Used by the "forgotten subscription"
 * anomaly check.
 */

const { google } = require('googleapis');

/**
 * Searches Google Calendar events from the last N days for mentions
 * of a specific merchant name in event titles or descriptions.
 *
 * @param {Object} auth - Google OAuth2 client
 * @param {string} merchant - Merchant/service name to search for
 * @param {number} [days=30] - Number of days to look back
 * @returns {Promise<boolean>} True if any calendar activity found for this merchant
 */
async function hasRecentActivity(auth, merchant, days = 30) {
  try {
    const calendar = google.calendar({ version: 'v3', auth });

    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - days);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: new Date().toISOString(),
      q: merchant, // Full-text search in event titles and descriptions
      singleEvents: true,
      maxResults: 5 // Only need to know if at least 1 event exists
    });

    const events = res.data.items || [];
    return events.length > 0;
  } catch (err) {
    // If Calendar API fails (permissions, etc.), assume activity exists
    // to avoid false-positive "unused subscription" alerts
    console.error(`⚠️ Calendar check failed for "${merchant}":`, err.message);
    return true;
  }
}

module.exports = { hasRecentActivity };
