/**
 * @module anomalyEngine
 * @description Core anomaly detection engine for BillGuard.
 * Runs 4 detection checks on every newly parsed bill:
 *   1. Price Hike Detection (>20% increase from average)
 *   2. Duplicate Charge Detection (same merchant 2+ times in 72h)
 *   3. Trial Expiry Warning (trial ending within 72h)
 *   4. Forgotten Subscription (no calendar activity for 60+ days)
 */

const sheetsService = require('./sheetsService');
const calendarService = require('./calendarService');

/**
 * CHECK 1: Price Hike Detection
 * Compares new charge against average of last 3 charges from same merchant.
 * Flags if new amount exceeds average by more than the configured threshold.
 *
 * @param {Object} auth - Google OAuth2 client
 * @param {Object} bill - Newly parsed bill object
 * @returns {Promise<Object|null>} Anomaly object or null if no anomaly
 */
async function checkPriceHike(auth, bill) {
  const threshold = parseInt(process.env.PRICE_HIKE_THRESHOLD || '20', 10);
  const history = await sheetsService.getBillHistory(auth, bill.merchant);

  // Need at least 1 previous charge to compare against
  if (history.length === 0) return null;

  // Take last 3 charges and compute average
  const recent = history.slice(-3);
  const amounts = recent.map(r => parseFloat(r.amount)).filter(a => !isNaN(a));
  if (amounts.length === 0) return null;

  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const increasePercent = ((bill.amount - avg) / avg) * 100;

  if (increasePercent > threshold) {
    return {
      type: 'price_hike',
      merchant: bill.merchant,
      amount: bill.amount,
      currency: bill.currency,
      message: `${bill.merchant} charged ${bill.currency} ${bill.amount} — ${Math.round(increasePercent)}% higher than your usual ${bill.currency} ${Math.round(avg)}`
    };
  }

  return null;
}

/**
 * CHECK 2: Duplicate Charge Detection
 * Finds charges from the same merchant within the configured time window
 * with similar amounts (within 5% tolerance).
 *
 * @param {Object} auth - Google OAuth2 client
 * @param {Object} bill - Newly parsed bill object
 * @returns {Promise<Object|null>} Anomaly object or null
 */
async function checkDuplicate(auth, bill) {
  const windowHours = parseInt(process.env.DUPLICATE_WINDOW_HOURS || '72', 10);
  const history = await sheetsService.getBillHistory(auth, bill.merchant);

  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - windowHours);

  // Find charges from same merchant in the time window with similar amount
  const recentSimilar = history.filter(r => {
    const detectedDate = new Date(r.detectedDate);
    const amt = parseFloat(r.amount);
    if (isNaN(amt)) return false;

    const amountDiff = Math.abs(amt - bill.amount) / bill.amount;
    return detectedDate >= windowStart && amountDiff <= 0.05;
  });

  // The current bill hasn't been added yet, so count includes just history
  if (recentSimilar.length >= 1) {
    const totalCount = recentSimilar.length + 1; // +1 for current bill
    return {
      type: 'duplicate',
      merchant: bill.merchant,
      amount: bill.amount,
      currency: bill.currency,
      message: `Possible duplicate charge from ${bill.merchant} — ${bill.currency} ${bill.amount} appeared ${totalCount} times in ${Math.round(windowHours / 24)} days`
    };
  }

  return null;
}

/**
 * CHECK 3: Trial Expiry Warning
 * Flags bills of type "trial" with a due date within 72 hours.
 *
 * @param {Object} bill - Newly parsed bill object
 * @returns {Object|null} Anomaly object or null
 */
function checkTrialExpiry(bill) {
  const warningHours = parseInt(process.env.TRIAL_WARNING_HOURS || '72', 10);

  if (bill.type !== 'trial') return null;
  if (!bill.dueDate) return null;

  const dueDate = new Date(bill.dueDate);
  const now = new Date();
  const hoursLeft = (dueDate - now) / (1000 * 60 * 60);

  if (hoursLeft > 0 && hoursLeft <= warningHours) {
    return {
      type: 'trial_expiry',
      merchant: bill.merchant,
      amount: bill.amount,
      currency: bill.currency,
      message: `Your free trial with ${bill.merchant} ends on ${bill.dueDate}. You will be charged ${bill.currency} ${bill.amount} unless you cancel.`
    };
  }

  return null;
}

/**
 * CHECK 4: Forgotten Subscription (run weekly only)
 * Cross-references recurring subscriptions with Google Calendar activity.
 * Flags subscriptions with no usage signal for 60+ days.
 *
 * @param {Object} auth - Google OAuth2 client
 * @returns {Promise<Array<Object>>} Array of anomaly objects
 */
async function checkForgottenSubscriptions(auth) {
  const unusedDays = parseInt(process.env.UNUSED_SUB_DAYS || '60', 10);
  const allBills = await sheetsService.getAllBills(auth);
  const anomalies = [];

  // Find recurring subscriptions active for 60+ days
  const recurring = allBills.filter(b =>
    b.isRecurring === 'TRUE' &&
    (b.type === 'subscription' || b.billingCycle === 'monthly' || b.billingCycle === 'yearly')
  );

  // Deduplicate by merchant name — keep the latest entry
  const merchantMap = new Map();
  for (const bill of recurring) {
    merchantMap.set(bill.merchant.toLowerCase(), bill);
  }

  for (const [, bill] of merchantMap) {
    const firstDetected = new Date(bill.detectedDate);
    const daysSinceFirst = (Date.now() - firstDetected) / (1000 * 60 * 60 * 24);

    // Only flag subs active for 60+ days
    if (daysSinceFirst < unusedDays) continue;

    // Check Google Calendar for usage signals
    const hasActivity = await calendarService.hasRecentActivity(auth, bill.merchant, 30);
    if (!hasActivity) {
      anomalies.push({
        type: 'forgotten_sub',
        merchant: bill.merchant,
        amount: parseFloat(bill.amount) || 0,
        currency: bill.currency || 'INR',
        message: `You've been paying ${bill.currency || 'INR'} ${bill.amount}/month for ${bill.merchant} but we haven't seen you use it in ${unusedDays}+ days.`
      });
    }
  }

  return anomalies;
}

/**
 * Runs all real-time anomaly checks (1-3) on a single bill.
 * Check 4 (forgotten subs) is run separately on a weekly schedule.
 *
 * @param {Object} auth - Google OAuth2 client
 * @param {Object} bill - Newly parsed bill object
 * @returns {Promise<Array<Object>>} Array of detected anomalies
 */
async function runChecks(auth, bill) {
  const anomalies = [];

  // Run checks in parallel for efficiency
  const [priceHike, duplicate] = await Promise.all([
    checkPriceHike(auth, bill),
    checkDuplicate(auth, bill)
  ]);

  if (priceHike) anomalies.push(priceHike);
  if (duplicate) anomalies.push(duplicate);

  // Trial check is synchronous — no API call needed
  const trial = checkTrialExpiry(bill);
  if (trial) anomalies.push(trial);

  return anomalies;
}

module.exports = { runChecks, checkForgottenSubscriptions };
