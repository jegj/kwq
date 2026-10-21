# KWQ

kwq (Qhawaq) analyzes Peruvian bank spending: it ingests bank emails per user, turns them into transactions, and alerts the user to categorize them.

## Language

**Email notification**:
A bank email received through the webhook and stored raw, with a parse status (unparsed, parsed, failed).
_Avoid_: Notification, alert, message

**Transaction**:
A single money movement (amount, currency, merchant, date) belonging to one user, created from a parsed email notification or entered manually.
_Avoid_: Payment, expense, movement

**Failed email**:
An email notification whose matched parser threw while parsing, so it has no transaction. Emails no parser matched are unparsed, not failed.
_Avoid_: Failed transaction

**Push alert**:
A browser-level message sent to a user's devices when a transaction needs categorizing or an email failed to parse. Tapping it opens the relevant page.
_Avoid_: Notification, browser notification, push notification

**Push subscription**:
One device's opt-in to receive push alerts; a user may have several.
_Avoid_: Subscriber, device token
