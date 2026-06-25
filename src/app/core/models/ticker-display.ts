export interface TickerDisplayItem {
  ticker?: string | null;
  displayTicker?: string | null;
  internalTicker?: string | null;
  instrumentName?: string | null;
}

export function getDisplayTicker(item: TickerDisplayItem): string {
  const canonicalTicker = canonicalTickerFor(item);
  if (canonicalTicker) return canonicalTicker;

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

function canonicalTickerFor(item: TickerDisplayItem): string | null {
  const byInstrumentName = canonicalTickerByInstrumentName(item.instrumentName);
  if (byInstrumentName) return byInstrumentName;

  const ticker = normalizeTicker(item.displayTicker) || normalizeTicker(item.internalTicker) || normalizeTicker(item.ticker);
  if (!ticker) return null;

  return tickerAliasMap[ticker] ?? null;
}

function canonicalTickerByInstrumentName(instrumentName?: string | null): string | null {
  const normalized = instrumentName?.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.includes('ast spacemobile')) return 'ASTS';
  if (normalized.includes('bitdeer technologies')) return 'BTDR';

  return null;
}

function normalizeTicker(ticker?: string | null): string {
  return cleanTrading212Ticker(ticker?.trim() ?? '').toUpperCase();
}

function cleanTrading212Ticker(ticker: string): string {
  return ticker
    .replace(/_(US|EU|GB|DE|FR|NL|ES|IT|CH|CA|HK|JP|AU)_EQ$/i, '')
    .replace(/_(US|EU|GB|DE|FR|NL|ES|IT|CH|CA|HK|JP|AU)$/i, '')
    .replace(/_EQ$/i, '');
}

const tickerAliasMap: Record<string, string> = {
  BSGA: 'BTDR',
  NPA: 'ASTS',
};
