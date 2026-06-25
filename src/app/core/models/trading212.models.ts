// ─── Connection ──────────────────────────────────────────────────────────────

export type ConnectionStatusKind = 'connected' | 'rate_limited' | 'not_validated' | 'disconnected';

export interface ConnectionStatus {
  status: ConnectionStatusKind;
  connected: boolean;
  environment: string;
  message: string;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export interface SyncOptions {
  fullResync?: boolean;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSuccessfulSync: string | null;
  lastFailedSync: string | null;
  lastDurationMs: number | null;
  rateLimit?: {
    isLimited: boolean;
    resetAt?: string;
    retryAfterSeconds?: number;
    remaining?: number;
    limit?: number;
  };
  totals: {
    ordersSynced: number;
    dividendsSynced: number;
    cashTransactionsSynced: number;
  };
}

export interface SyncLogEntry {
  _id: string;
  startedAt: string;
  completedAt: string | null;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  ordersSynced: number;
  dividendsSynced: number;
  cashTransactionsSynced: number;
  errorMessage: string | null;
}

export interface SyncRecordResult {
  synced: number;
  skipped: number;
}

export type SyncResult =
  | SyncSuccessResult
  | SyncRateLimitedResult
  | SyncFailedResult;

export interface SyncSuccessResult {
  status: 'success';
  result: {
    orders: SyncRecordResult;
    dividends: SyncRecordResult;
    cashTransactions: SyncRecordResult;
    completedAt?: string;
  };
}

export interface SyncRateLimitedResult {
  status: 'rate_limited';
  message: string;
  retryAfterSeconds?: number;
  resetAt?: string;
}

export interface SyncFailedResult {
  status: 'failed';
  message?: string;
}

// ─── Query Params ─────────────────────────────────────────────────────────────

export interface HistoryQueryParams {
  year?: number;
  page?: number;
  limit?: number;
}

// ─── Paginated Response ───────────────────────────────────────────────────────

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface T212Order {
  id: string;
  dateExecuted: string;
  ticker: string;
  displayTicker?: string;
  internalTicker?: string;
  instrumentName?: string;
  instrumentIsin?: string;
  side: 'BUY' | 'SELL';
  fillQuantity: number;
  fillPrice: number;
  instrumentCurrency: string;
  walletNetValue: number;
  walletFxRate?: number;
  walletRealisedPnl?: number | null;
  accountCurrency: string;
}

// ─── Dividends ────────────────────────────────────────────────────────────────

export interface T212Dividend {
  id: string;
  paidOn: string;
  ticker: string;
  displayTicker?: string;
  internalTicker?: string;
  instrumentName?: string;
  instrumentIsin?: string;
  instrumentCurrency?: string;
  dividendType: string;
  quantity: number;
  grossAmountPerShare: number;
  amount: number;
  amountInEuro?: number;
  reference?: string;
}

// ─── Cash Transactions ────────────────────────────────────────────────────────

export interface T212CashTransaction {
  id: string;
  dateTime: string;
  transactionType: string;
  amount: number;
  currency: string;
  externalId?: string;
  reference?: string;
}

// ─── Positions ────────────────────────────────────────────────────────────────

export interface PositionLot {
  orderId?: string;
  qty: number;
  costPerShareNative: number;
  costPerShareAccount: number;
  instrumentCurrency: string;
  accountCurrency: string;
  acquiredOn: string;
}

export interface OpenPosition {
  ticker?: string;
  displayTicker?: string;
  internalTicker?: string;
  instrumentName?: string;
  instrumentIsin?: string;
  instrumentCurrency: string;
  accountCurrency: string;
  quantity: number;
  averageCostNative: number;
  totalInvestedNative: number;
  averageCostAccount: number;
  totalInvestedAccount: number;
  lots: PositionLot[];
}

// ─── Tax Calculation ──────────────────────────────────────────────────────────

export interface MatchedLot {
  ticker?: string;
  displayTicker?: string;
  internalTicker?: string;
  buyOrderId?: string;
  sellOrderId?: string;
  buyDate: string;
  sellDate: string;
  qty: number;
  accountCostPerShare: number;
  accountProceedsPerShare: number;
  accountCostBasis: number;
  accountProceeds: number;
  accountRealizedPnl: number;
  buyPriceNative: number;
  sellPriceNative: number;
  instrumentCurrency: string;
  accountCurrency: string;
}

export interface TickerTaxSummary {
  ticker: string;
  displayTicker?: string;
  internalTicker?: string;
  instrumentName?: string;
  instrumentIsin?: string;
  instrumentCurrency?: string;
  accountRealizedPnl: number;
  accountCostBasis: number;
  accountProceeds: number;
  tradeCount: number;
}

export interface FifoTaxSummary {
  year: number;
  method: 'FIFO';
  accountRealizedPnl: number;
  accountTotalCostBasis: number;
  accountTotalProceeds: number;
  accountCurrency: string;
  byTicker: TickerTaxSummary[];
  matchedLots: MatchedLot[];
}

// Tax Center

export type TaxCenterWarningSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface TaxCenterWarning {
  severity: TaxCenterWarningSeverity | string;
  code: string;
  message: string;
  count: number;
}

export interface TaxCenterYear {
  year: number;
  realizedPnlEur: number;
  costBasisEur: number;
  proceedsEur: number;
  dividendsEur: number;
  depositsEur: number;
  withdrawalsEur: number;
  feesEur: number;
  ordersCount: number;
  reportsCount: number;
  latestReportDate: string | null;
  hasWarnings: boolean;
}

export interface TaxCenterResponse {
  environment: CredentialEnvironment | string;
  years: TaxCenterYear[];
  warnings: TaxCenterWarning[];
}

// ─── Yearly Summary ───────────────────────────────────────────────────────────

export interface YearlySummary {
  year: number;
  realizedPnl: number;
  dividendIncome: number;
  cashDeposits: number;
  cashWithdrawals: number;
  netCashFlow: number;
  openPositionsCount?: number;
  lastSyncedAt?: string;
}

// ─── Credentials ─────────────────────────────────────────────────────────────

export type CredentialEnvironment = 'demo' | 'live';
export type ValidationStatus = 'valid' | 'invalid' | 'unknown';

export interface MaskedCredentials {
  userId: string;
  environment: CredentialEnvironment;
  maskedApiKey: string;
  isActive: boolean;
  validationStatus: ValidationStatus;
  lastValidatedAt: string | null;
  lastValidationError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationResult {
  validationStatus: 'valid' | 'invalid' | 'rate_limited';
  validatedAt: string;
  error?: string;
}

export interface CreateCredentialsPayload {
  environment: CredentialEnvironment;
  apiKey: string;
  apiSecret?: string;
}

export interface UpdateCredentialsPayload {
  apiKey: string;
  apiSecret?: string;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportReportPayload {
  year: number;
  format: 'xlsx';
}

export interface ReportRecord {
  _id: string;
  year: number;
  generatedAt: string;
  filename: string;
  reportVersion: string;
  totalOrders: number;
  totalDividends: number;
  realizedPnl: number;
  generatedBy: string;
  notes: string[];
}
