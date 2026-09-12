function loadSeen() {
  const raw = PropertiesService.getScriptProperties().getProperty('seenIds');
  return new Set(raw ? JSON.parse(raw) : []);
}

// Trims to the most recent maxSeenIds. If more than maxSeenIds messages match
// within CONFIG.lookbackWindow, the evicted (oldest) IDs can still fall inside
// the next search window and get POSTed to the webhook again as "new".
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
  const threads = GmailApp.search(buildGmailSearchQuery(), 0, CONFIG.maxThreads);
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
