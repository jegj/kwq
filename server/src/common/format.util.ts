import { APP_TIMEZONE, toInputValue } from './timezone.util.js';

export function formatMoney(amount: string | number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency,
    }).format(Number(amount));
  } catch {
    // ponytail: unknown ISO code, show the raw value rather than failing the page.
    return `${amount} ${currency}`;
  }
}

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

// Value for `<input type="datetime-local">`, in the app zone.
export function formatInputValue(date: Date): string {
  return toInputValue(APP_TIMEZONE, date);
}

// Banks send merchants in ALL CAPS; mixed-case text is already intentional.
export function titleCase(text: string): string {
  if (text !== text.toUpperCase()) {
    return text;
  }
  return text
    .toLowerCase()
    .replace(/(^|\s)\S/g, (match) => match.toUpperCase());
}
