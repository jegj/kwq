import { toInputValue } from './timezone.util.js';

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

// Date helpers bound to one zone, built once at boot from APP_TIMEZONE.
export function createDateFormatters(timeZone: string) {
  const dateTime = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return {
    formatDateTime: (date: Date): string => dateTime.format(date),
    // Value for `<input type="datetime-local">`, in the app zone.
    formatInputValue: (date: Date): string => toInputValue(timeZone, date),
  };
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
