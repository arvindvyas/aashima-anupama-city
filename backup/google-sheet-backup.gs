/**
 * Society Hub — nightly backup into a Google Sheet (free).
 *
 * Setup (5 minutes, done once by an admin):
 * 1. Create a new Google Sheet, e.g. "Green Meadows – Society Hub backup".
 * 2. Extensions → Apps Script. Delete the sample code and paste this whole file.
 * 3. Fill the three values below:
 *      SUPABASE_URL  and ANON_KEY  → same as in js/config.js
 *      EXPORT_KEY                  → Society Hub → Settings → Backups → "Google Sheet nightly backup key"
 * 4. Click Run ▶ on "backupNow" once. Google asks for permission → allow.
 *    Tabs appear: villas, members, dues, expenses, notices, tickets, bookings.
 * 5. Run "setupNightly" once. From now on the sheet refreshes every night at about 2 AM.
 *
 * The sheet keeps its own version history (File → Version history), so older copies are kept too.
 * Keep this sheet private: it contains residents' names and phone numbers.
 */
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const ANON_KEY = 'paste-anon-key-here';
const EXPORT_KEY = 'paste-export-key-here';

const TABS = ['villas', 'members', 'dues', 'expenses', 'notices', 'tickets', 'bookings'];

function backupNow() {
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/export_society', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY },
    payload: JSON.stringify({ p_key: EXPORT_KEY }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Backup failed: ' + res.getContentText());
  const data = JSON.parse(res.getContentText());
  const ss = SpreadsheetApp.getActive();
  TABS.forEach(name => writeSheet(ss, name, data[name] || []));
  writeSheet(ss, 'info', [{ society: data.society.name, last_backup: data.exported_at, villas: data.villas.length, bills: data.dues.length }]);
}

function writeSheet(ss, name, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  if (!rows.length) { sh.getRange(1, 1).setValue('No data yet'); return; }
  const cols = Object.keys(rows[0]);
  const values = [cols].concat(rows.map(r => cols.map(c => (r[c] === null || r[c] === undefined) ? '' : r[c])));
  sh.getRange(1, 1, values.length, cols.length).setValues(values);
  sh.setFrozenRows(1);
}

function setupNightly() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('backupNow').timeBased().everyDays(1).atHour(2).create();
}
