function buildPayload(message) {
  return {
    messageId: message.getId(),
    threadId: message.getThread().getId(),
    receivedAt: message.getDate().toISOString(),
    from: message.getFrom(),
    to: message.getTo(),
    subject: message.getSubject(),
    body: message.getPlainBody().slice(0, CONFIG.bodyCharLimit),
    bodyHtml: message.getBody().slice(0, CONFIG.bodyCharLimit),
    attachments: message.getAttachments().map(a => ({
      name: a.getName(), size: a.getSize(), contentType: a.getContentType()
    })),
  };
}

function postToWebhook(message) {
  const payload = buildPayload(message);

  if (CONFIG.dryRun) {
    console.log(`dryRun: would POST ${payload.messageId} "${payload.subject}" ` +
                `body: ${payload.body.slice(0, 200)}`);
    return true;
  }

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
  return false;   // not marked seen → retried next run
}
