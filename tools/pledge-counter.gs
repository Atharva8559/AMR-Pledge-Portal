/**
 * ACT4AMR — pledge counter backend (Google Apps Script)
 *
 * A real count. It stores ONE number and nothing else: no names, no contact
 * details, no IP addresses, no analytics. There is nothing here that could
 * identify a person, which is the point — the page asks for a promise, not for
 * personal data.
 *
 * ─── DEPLOY (about two minutes, no signup beyond a Google account) ───────────
 *
 *  1. Go to https://script.google.com and click "New project".
 *  2. Delete whatever is in Code.gs and paste this whole file in.
 *  3. Click Deploy ▸ New deployment.
 *  4. Click the gear next to "Select type" and choose "Web app".
 *  5. Set:  Execute as        →  Me
 *           Who has access    →  Anyone
 *     ("Anyone" means anyone can increment the counter. It does NOT give anyone
 *      access to your Google account or Drive.)
 *  6. Click Deploy, authorise when prompted, and copy the Web app URL. It looks
 *     like  https://script.google.com/macros/s/AKfyc.../exec
 *  7. Paste that URL into PLEDGE_COUNTER_URL near the top of app.js.
 *
 * To check the current total in a browser, open the same URL directly — a plain
 * GET returns the count without incrementing it.
 *
 * ─── STARTING FROM A REAL NUMBER ────────────────────────────────────────────
 * If the campaign already has a genuine pledge total from before this page
 * existed, set STARTING_COUNT to it and say so publicly. Do NOT put a made-up
 * number here to make the page look busier — that is exactly the fabricated
 * statistic this project removed once already.
 */

var STARTING_COUNT = 0;      // only ever a real, defensible figure
var COUNTER_KEY = 'act4amr_pledge_count';

/** Plain GET: report the count. Never increments, so refreshes cannot inflate it. */
function doGet() {
  return jsonResponse({ count: readCount() });
}

/** POST from the page: record one pledge and return the new total. */
function doPost(e) {
  var count = increment();
  return jsonResponse({ count: count });
}

function readCount() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(COUNTER_KEY);
  if (raw === null) return STARTING_COUNT;
  var n = parseInt(raw, 10);
  return isNaN(n) ? STARTING_COUNT : n;
}

/**
 * Increment under a lock. Without it two pledges landing in the same moment
 * both read the same value and one of them is silently lost — rare, but it
 * makes the number quietly wrong, which is the one thing it must not be.
 */
function increment() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
  } catch (err) {
    return readCount();               // busy: report, do not guess
  }
  try {
    var props = PropertiesService.getScriptProperties();
    var next = readCount() + 1;
    props.setProperty(COUNTER_KEY, String(next));
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
