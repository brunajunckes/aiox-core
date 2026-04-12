/**
 * Currency formatting utilities
 * Story 45.5 — Plantar Project Management UI + Business Logic
 */

/**
 * Format a number as currency with locale and currency code
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'BRL',
  locale: string = 'pt-BR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parse a formatted currency string back to a number
 */
export function parseCurrency(formattedValue: string): number {
  const cleaned = formattedValue
    .replace(/[^\d,.-]/g, '')
    .replace('.', '')
    .replace(',', '.');
  return parseFloat(cleaned) || 0;
}
