export interface TickerDisplayItem {
  ticker?: string | null;
  displayTicker?: string | null;
  internalTicker?: string | null;
}

export function getDisplayTicker(item: TickerDisplayItem): string {
  const displayTicker = item.displayTicker?.trim();
  if (displayTicker) return displayTicker;

  const ticker = item.ticker?.trim();
  if (!ticker) return '-';

  const cleaned = cleanTrading212Ticker(ticker);
  return cleaned || ticker;
}

export function getInternalTicker(item: TickerDisplayItem): string | null {
  const internalTicker = item.internalTicker?.trim() || item.ticker?.trim();
  const displayTicker = getDisplayTicker(item);
  return internalTicker && internalTicker !== displayTicker ? internalTicker : null;
}

function cleanTrading212Ticker(ticker: string): string {
  return ticker
    .replace(/_(US|EU|GB|DE|FR|NL|ES|IT|CH|CA|HK|JP|AU)_EQ$/i, '')
    .replace(/_(US|EU|GB|DE|FR|NL|ES|IT|CH|CA|HK|JP|AU)$/i, '')
    .replace(/_EQ$/i, '');
}
