/** Kurongeka prices in pounds sterling. Launch packages and Run plans are all GBP. */
export const CURRENCY = 'GBP';

const formatters = new Map<string, Intl.NumberFormat>();

/** Locale per currency so symbols read naturally. Run plans show the currency Wix charges in (GBP). */
const CURRENCY_LOCALE: Record<string, string> = { USD: 'en-US', GBP: 'en-GB', ZAR: 'en-ZA', EUR: 'en-IE' };

/** A price in the business currency, e.g. formatPrice(990) -> "£990". */
export function formatPrice(amount: number): string {
  return formatMoney(amount, CURRENCY);
}

/** Whole-unit money, e.g. formatMoney(990, 'GBP') -> "£990". */
export function formatMoney(amount: number, currency: string): string {
  const key = currency.toUpperCase();
  const decimals = Number.isInteger(amount) ? 0 : 2;
  const cacheKey = `${key}:${decimals}`;
  let formatter = formatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(CURRENCY_LOCALE[key] ?? 'en-GB', {
      style: 'currency',
      currency: key,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formatters.set(cacheKey, formatter);
  }
  return formatter.format(amount);
}

export function workingDays(days: number | null): string | null {
  if (days === null) return null;
  return days === 1 ? '1 working day' : `${days} working days`;
}

/** Splits CMS plain text into paragraphs on blank lines. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
