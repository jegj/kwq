/**
 * Gmail → webhook bridge (Google Apps Script)
 *
 * Watches selected senders and POSTs matching messages to your endpoint.
 *
 * Setup:
 *   1. script.google.com → New project → paste this in
 *   2. Edit CONFIG below
 *   3. Run markExistingAsSeen() once (authorize when prompted)
 *   4. Run installTrigger() once
 */
 
const CONFIG = {
  senders: ['notificaciones@notificacionesbcp.com.pe', 'javiergalarza4@gmail.com'],
  webhookUrl: 'https://webhook.example.com/hooks/gmail',
  sharedSecret: 'change-me-to-a-long-random-string',
  lookbackWindow: '2d',   // only search recent mail; keeps runs fast
  maxThreads: 25,         // safety cap per run
  maxSeenIds: 500,        // Properties caps at 9KB per value
  bodyCharLimit: 10000,
  pollMinutes: 5,         // 1, 5, 10, 15 or 30
};
 
function buildQuery() {
  const clauses = CONFIG.senders.map(s => `from:${s}`).join(' OR ');
  return `(${clauses}) newer_than:${CONFIG.lookbackWindow}`;
}
 
function loadSeen() {
  const raw = PropertiesService.getScriptProperties().getProperty('seenIds');
  return new Set(raw ? JSON.parse(raw) : []);
}
 
function saveSeen(seen) {
  const trimmed = Array.from(seen).slice(-CONFIG.maxSeenIds);
  PropertiesService.getScriptProperties()
    .setProperty('seenIds', JSON.stringify(trimmed));
}
 
function isWatchedSender(message) {
  const from = message.getFrom().toLowerCase();
  return CONFIG.senders.some(s => from.includes(s.toLowerCase()));
}
 
function findNewMessages(seen) {
  const threads = GmailApp.search(buildQuery(), 0, CONFIG.maxThreads);
  const fresh = [];
  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      if (seen.has(message.getId())) return;
      if (!isWatchedSender(message)) return;   // skip your own replies
      fresh.push(message);
    });
  });
  return fresh.sort((a, b) => a.getDate() - b.getDate());
}
 
function postToWebhook(message) {
  const payload = {
    messageId: message.getId(),
    threadId: message.getThread().getId(),
    receivedAt: message.getDate().toISOString(),
    from: message.getFrom(),
    to: message.getTo(),
    subject: message.getSubject(),
    body: message.getPlainBody().slice(0, CONFIG.bodyCharLimit),
    attachments: message.getAttachments().map(a => ({
      name: a.getName(), size: a.getSize(), contentType: a.getContentType()
    })),
  };
 
 /*
  const response = UrlFetchApp.fetch(CONFIG.webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Webhook-Secret': CONFIG.sharedSecret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
 
  const code = response.getResponseCode();
  if (code >= 200 && code < 300) return true;
 
  console.warn(`Webhook ${code} for ${message.getId()}: ` +
               response.getContentText().slice(0, 200));
  */
  console.log('sending');
  return true;
  //return false;   // not marked seen → retried next run
}
 
function checkMail() {
  console.log('checkMail tick ' + new Date().toISOString());
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;   // a previous run is still going
 
  try {
    const seen = loadSeen();
    const messages = findNewMessages(seen);
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
  GmailApp.search(buildQuery(), 0, 500).forEach(thread => {
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
