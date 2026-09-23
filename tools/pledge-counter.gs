/**
 * DISPOSEFORHEALTH — counter backend (Google Apps Script)
 *
 * Tracks TWO independent numbers:
 *   • Pledge completions   → stored under PLEDGE_KEY, returned as { count: N }
 *   • Quiz completions     → stored under QUIZ_KEY,   returned as { quiz_count: N }
 *
 * Nothing else is stored — no names, no contact details, no IP addresses.
 *
 * ─── DEPLOY / REDEPLOY ───────────────────────────────────────────────────────
 *
 *  First-time deploy:
 *   1. Go to https://script.google.com → New project.
 *   2. Replace Code.gs with this file.
 *   3. Deploy ▸ New deployment ▸ Type = Web app.
 *      Execute as: Me   |   Who has access: Anyone
 *   4. Copy the Web app URL and paste it into PLEDGE_COUNTER_URL in app.js.
 *
 *  Updating an existing deployment (what you need to do now):
 *   1. Open your existing project at https://script.google.com.
 *   2. Replace the script with this file and click Save.
 *   3. Deploy ▸ Manage deployments ▸ Edit (pencil) the live deployment.
 *   4. Change "Version" to "New version" and click Deploy.
 *      *** The URL stays exactly the same — no changes needed in app.js. ***
 *
 * ─── GET request ─────────────────────────────────────────────────────────────
 * Returns both totals without incrementing either:
 *   { "count": 42, "quiz_count": 17 }
 *
 * ─── POST request ─────────────────────────────────────────────────────────────
 * Body must be JSON with an "action" field:
 *   { "action": "pledge" }        → increments pledge counter, returns { "count": N }
 *   { "action": "quiz_complete" } → increments quiz counter,  returns { "quiz_count": N }
 *
 * ─── STARTING COUNTS ─────────────────────────────────────────────────────────
 * If the campaign already has genuine pledge totals from before this script,
 * set STARTING_PLEDGE_COUNT to that real number. Never invent a number.
 */

var STARTING_PLEDGE_COUNT = 0;   // only ever a real, defensible figure
var STARTING_QUIZ_COUNT   = 0;

var PLEDGE_KEY = 'dfh_pledge_count';
var QUIZ_KEY   = 'dfh_quiz_count';

// ─── GET: report both counters, never increment ───────────────────────────────
function doGet() {
  return jsonResponse({
    count:      readCount(PLEDGE_KEY, STARTING_PLEDGE_COUNT),
    quiz_count: readCount(QUIZ_KEY,   STARTING_QUIZ_COUNT)
  });
}

// ─── POST: route by action field ─────────────────────────────────────────────
function doPost(e) {
  var body   = {};
  var action = 'pledge';   // safe default: legacy callers that omit action still increment pledges

  try {
    body   = JSON.parse(e.postData.contents);
    action = (body.action || 'pledge').toString().trim().toLowerCase();
  } catch (err) { /* malformed body: treat as pledge */ }

  if (action === 'quiz_complete') {
    var quizTotal = incrementCounter(QUIZ_KEY, STARTING_QUIZ_COUNT);
    return jsonResponse({ quiz_count: quizTotal });
  }

  // Default: 'pledge'
  var pledgeTotal = incrementCounter(PLEDGE_KEY, STARTING_PLEDGE_COUNT);
  return jsonResponse({ count: pledgeTotal });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readCount(key, startingValue) {
  var props = PropertiesService.getScriptProperties();
  var raw   = props.getProperty(key);
  if (raw === null) return startingValue;
  var n = parseInt(raw, 10);
  return isNaN(n) ? startingValue : n;
}

/**
 * Increment under a lock. Without it two requests arriving simultaneously both
 * read the same value and one increment is silently lost.
 */
function incrementCounter(key, startingValue) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
  } catch (err) {
    return readCount(key, startingValue);   // busy — report current, don't guess
  }
  try {
    var props = PropertiesService.getScriptProperties();
    var next  = readCount(key, startingValue) + 1;
    props.setProperty(key, String(next));
    return next;
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
