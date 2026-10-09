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

function findBank(message) {
  const from = message.getFrom().toLowerCase();
  return BANKS.find(b => b.senders.some(s => from.includes(s.toLowerCase())));
}

// fresh: messages to POST. skipped: watched-sender messages the bank's
// shouldTrack rejected; the caller marks them seen so they're not re-checked.
function findNewMessages(seen) {
  const threads = GmailApp.search(buildGmailSearchQuery(), 0, CONFIG.maxThreads);
  const fresh = [];
  const skipped = [];
  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      if (seen.has(message.getId())) return;
      const bank = findBank(message);
      if (!bank) return;   // skip your own replies
      (bank.shouldTrack(message) ? fresh : skipped).push(message);
    });
  });
  return { fresh: fresh.sort((a, b) => a.getDate() - b.getDate()), skipped };
}
