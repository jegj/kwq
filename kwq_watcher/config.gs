const CONFIG = {
  webhookUrl: 'https://encounter-ridge-buildings-windsor.trycloudflare.com',
  webhookToken: '1a892301-63cf-46e0-b6be-18da2672ccc8',  // sent as X-Kwq-Token
  lookbackWindow: '2d',   // only search recent mail; keeps runs fast
  maxThreads: 25,         // safety cap per run
  // Properties caps at 9KB per value; 500 IDs as JSON overflows it.
  // Once this cap is hit, saveSeen() evicts the oldest IDs (see gmail.gs).
  // If more than maxSeenIds messages match within lookbackWindow, an evicted
  // ID can still be inside the search window and get POSTed again as "new".
  maxSeenIds: 400,
  bodyCharLimit: 10000,
  pollMinutes: 5,         // 1, 5, 10, 15 or 30
  dryRun: false,           // flip to false to actually POST
};

function buildGmailSearchQuery() {
  const senders = BANKS.flatMap(b => b.senders);
  const clauses = senders.map(s => `from:${s}`).join(' OR ');
  return `(${clauses}) newer_than:${CONFIG.lookbackWindow}`;
}
