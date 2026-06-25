export type VixFearRegime =
  | 'extreme_fear'
  | 'fear'
  | 'neutral'
  | 'calm'
  | 'extreme_calm'
  | string;

export interface VixFearGaugeSnapshot {
  value: number;
  percentile1Y: number;
  fearScore: number;
  label: string;
  regime: VixFearRegime;
}

export interface VixFearGauge extends VixFearGaugeSnapshot {
  symbol: 'VIX' | string;
  description: string;
  previousClose?: VixFearGaugeSnapshot | null;
  updatedAt: string;
  source: string;
}
