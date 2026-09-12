/**
 * KWQ Watcher
 *
 * Watches selected senders and POSTs matching messages to your endpoint.
 *
 * Setup:
 *   1. script.google.com → New project → paste this in
 *   2. Edit CONFIG in config.gs
 *   3. Run markExistingAsSeen() once (authorize when prompted)
 *   4. Run installTrigger() once
 */

function checkMail() {
  console.log('checkMail tick ' + new Date().toISOString());
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;   // a previous run is still going

  try {
    const seen = loadSeen();
    const messages = findNewMessages(seen);
    console.log(`Found ${messages.length} new message(s).`);
    messages.forEach(m => {
      if (postToWebhook(m)) seen.add(m.getId());
    });
    if (messages.length) saveSeen(seen);
  } finally {
    lock.releaseLock();
  }
}

/** Run once before installTrigger() so old mail doesn't fire the webhook. */
function markExistingAsSeen() {
  const seen = loadSeen();
  GmailApp.search(buildGmailSearchQuery(), 0, 500).forEach(thread => {
    thread.getMessages().forEach(m => seen.add(m.getId()));
  });
  saveSeen(seen);
  console.log(`Marked ${seen.size} existing message(s) as seen.`);
}

/** Run once to schedule checkMail(). Safe to re-run after changing pollMinutes. */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'checkMail')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('checkMail')
    .timeBased()
    .everyMinutes(CONFIG.pollMinutes)
    .create();

  console.log(`Polling every ${CONFIG.pollMinutes} minute(s).`);
}
