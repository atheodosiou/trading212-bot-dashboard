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

export interface SyncResult {
  ordersAdded: number;
  dividendsAdded: number;
  cashTransactionsAdded: number;
  errors: string[];
  syncedAt?: string;
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
  instrumentName?: string;
  side: 'BUY' | 'SELL';
  fillQuantity: number;
  fillPrice: number;
  instrumentCurrency: string;
  walletNetValue: number;
  walletFxRate?: number;
  walletRealisedPnl?: number;
  accountCurrency: string;
}

// ─── Dividends ────────────────────────────────────────────────────────────────

export interface T212Dividend {
  id: string;
  paidOn: string;
  ticker: string;
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
  date: string;
  quantity: number;
  price: number;
  totalCost: number;
}

export interface OpenPosition {
  ticker: string;
  quantity: number;
  averageCost: number;
  totalInvested: number;
  lots: PositionLot[];
}

// ─── Tax Calculation ──────────────────────────────────────────────────────────

export interface MatchedLot {
  buyOrderId?: string;
  sellOrderId?: string;
  buyDate: string;
  sellDate: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  gain: number;
  currency?: string;
}

export interface TickerTaxSummary {
  ticker: string;
  realizedPnl: number;
  costBasis: number;
  proceeds: number;
  matchedLots: MatchedLot[];
}

export interface FifoTaxSummary {
  year: number;
  method: 'FIFO';
  realizedPnl: number;
  totalCostBasis: number;
  totalProceeds: number;
  byTicker: TickerTaxSummary[];
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
