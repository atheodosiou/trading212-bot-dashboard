export type IndexVisibility = 'system' | 'user';
export type IndexStatus = 'BUILDING' | 'READY' | 'PARTIAL' | 'FAILED' | 'REBALANCING' | 'DELETED';
export type WeightingMethod = 'market_cap_capped' | 'equal_weight';
export type DataSource = 'trading212' | 'massive' | 'cache';

export interface CreateCustomIndexRequest {
  name: string;
  description?: string;
  theme?: string;
  visibility: IndexVisibility;
  symbols: string[];
  weightingMethod?: WeightingMethod;
  maxWeight?: number;
  backfillMonths?: number;
}

export interface RebalanceCustomIndexRequest {
  symbols: string[];
  weightingMethod?: WeightingMethod;
  maxWeight?: number;
  effectiveDate?: string;
  reason?: 'manual_rebalance' | 'constituent_change';
}

export interface IndexListItem {
  id: string;
  name: string;
  description: string | null;
  theme: string | null;
  visibility: IndexVisibility;
  status: IndexStatus;
  value: number;
  dailyReturn: number;
  latestSnapshot: { date: string; value: number; dailyReturn: number } | null;
  constituentCount: number;
}

export interface IndexConstituent {
  symbol: string;
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  rawWeight: number;
  weight: number;
  dataSource: DataSource;
  dailyReturn: number;
  contribution: number;
}

export interface IndexDetails {
  id: string;
  name: string;
  description: string | null;
  theme: string | null;
  visibility: IndexVisibility;
  weightingMethod?: WeightingMethod;
  maxWeight?: number | null;
  status: IndexStatus;
  statusMessage: string | null;
  value: number;
  dailyReturn: number;
  historyStatus: 'complete' | 'partial' | 'unavailable';
  constituents: IndexConstituent[];
  dataQuality: {
    missingProfiles: string[];
    missingPrices: string[];
    usedCachedData: boolean;
    providerCallsUsed: number;
    providerCallsRemaining: number | null;
    providerRateLimit?: {
      callsPerMinute: number;
      minIntervalMs: number;
    };
  };
}

export interface IndexHistoryPoint {
  date: string;
  value: number;
  dailyReturn: number;
}

export interface IndexDashboard {
  latestValue: number;
  dailyReturn: number;
  history: IndexHistoryPoint[];
  constituents: IndexConstituent[];
  topContributors: { symbol: string; contribution: number }[];
  topDetractors: { symbol: string; contribution: number }[];
  summary: {
    bestPerformer: string | null;
    worstPerformer: string | null;
    largestWeight: string | null;
    constituents: number;
  };
  health: {
    priceCoverage: number;
    profileCoverage: number;
    lastRefresh: string | null;
    status: IndexStatus;
  };
  dataQuality: IndexDetails['dataQuality'];
}

export interface AsyncIndexOperationResponse {
  id: string;
  status: 'BUILDING' | 'REBALANCING';
}

export interface DeleteResponse {
  deleted: true;
}
