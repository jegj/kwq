// applicationServerKey wants bytes, the server hands us base64url.
function toBytes(base64Url) {
  const padded = base64Url.padEnd(
    base64Url.length + ((4 - (base64Url.length % 4)) % 4),
    '=',
  );
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export default (publicKey) => ({
  supported: 'serviceWorker' in navigator && 'PushManager' in window,
  // Hidden until init() has checked this device.
  subscribed: true,
  denied: false,
  busy: false,
  error: null,
  async init() {
    if (!this.supported) return;
    const registration = await navigator.serviceWorker.ready;
    this.subscribed = Boolean(await registration.pushManager.getSubscription());
  },
  async enable() {
    this.busy = true;
    this.error = null;
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        this.denied = true;
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toBytes(publicKey),
      });
      const { endpoint, keys } = subscription.toJSON();
      const response = await fetch('/app/push/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        }),
      });
      if (!response.ok) throw new Error('request failed');
      this.subscribed = true;
    } catch (caught) {
      console.error(caught);
      this.error = `Could not enable alerts: ${caught.message}`;
    } finally {
      this.busy = false;
    }
  },
});
