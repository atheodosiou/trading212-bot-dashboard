import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  ConnectionStatus,
  CreateCredentialsPayload,
  ExportReportPayload,
  FifoTaxSummary,
  HistoryQueryParams,
  MaskedCredentials,
  OpenPosition,
  PagedResult,
  ReportRecord,
  SyncLogEntry,
  SyncOptions,
  SyncResult,
  SyncStatus,
  T212CashTransaction,
  T212Dividend,
  T212Order,
  UpdateCredentialsPayload,
  ValidationResult,
  YearlySummary,
} from '../models/trading212.models';

@Injectable({ providedIn: 'root' })
export class Trading212ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/trading212`;

  // ─── Credentials ─────────────────────────────────────────────────────────────

  getCredentials(): Observable<MaskedCredentials[]> {
    return this.http.get<MaskedCredentials[]>(`${this.base}/credentials`);
  }

  createCredentials(payload: CreateCredentialsPayload): Observable<MaskedCredentials> {
    return this.http.post<MaskedCredentials>(`${this.base}/credentials`, payload);
  }

  updateCredentials(environment: string, payload: UpdateCredentialsPayload): Observable<MaskedCredentials> {
    return this.http.patch<MaskedCredentials>(`${this.base}/credentials/${environment}`, payload);
  }

  deleteCredentials(environment: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/credentials/${environment}`);
  }

  validateCredentials(environment: string): Observable<ValidationResult> {
    return this.http.post<ValidationResult>(`${this.base}/credentials/${environment}/validate`, {});
  }

  activateCredentials(environment: string): Observable<MaskedCredentials> {
    return this.http.patch<MaskedCredentials>(`${this.base}/credentials/${environment}/activate`, {});
  }

  // ─── Connection ──────────────────────────────────────────────────────────────

  getConnectionStatus(): Observable<ConnectionStatus> {
    return this.http.get<ConnectionStatus>(`${this.base}/connection`);
  }

  // ─── Sync ─────────────────────────────────────────────────────────────────────

  triggerSync(options: SyncOptions = {}): Observable<SyncResult> {
    return this.http.post<SyncResult>(`${this.base}/sync`, options);
  }

  triggerManualSync(options: SyncOptions = {}): Observable<SyncResult> {
    return this.http.post<SyncResult>(`${this.base}/sync`, options);
  }

  getSyncStatus(): Observable<SyncStatus> {
    return this.http.get<SyncStatus>(`${this.base}/sync/status`);
  }

  getSyncHistory(): Observable<SyncLogEntry[]> {
    return this.http.get<SyncLogEntry[]>(`${this.base}/sync/history`);
  }

  // ─── Orders ───────────────────────────────────────────────────────────────────

  getOrders(query: HistoryQueryParams = {}): Observable<PagedResult<T212Order>> {
    return this.http.get<PagedResult<T212Order>>(`${this.base}/orders`, {
      params: buildHistoryParams(query),
    });
  }

  // ─── Dividends ────────────────────────────────────────────────────────────────

  getDividends(query: HistoryQueryParams = {}): Observable<PagedResult<T212Dividend>> {
    return this.http.get<PagedResult<T212Dividend>>(`${this.base}/dividends`, {
      params: buildHistoryParams(query),
    });
  }

  // ─── Cash Transactions ────────────────────────────────────────────────────────

  getCashTransactions(query: HistoryQueryParams = {}): Observable<PagedResult<T212CashTransaction>> {
    return this.http.get<PagedResult<T212CashTransaction>>(`${this.base}/cash-transactions`, {
      params: buildHistoryParams(query),
    });
  }

  // ─── Positions ────────────────────────────────────────────────────────────────

  getPositions(): Observable<OpenPosition[]> {
    return this.http.get<OpenPosition[]>(`${this.base}/positions`);
  }

  // ─── Tax Calculation ──────────────────────────────────────────────────────────

  getTaxSummary(year: number): Observable<FifoTaxSummary> {
    return this.http.get<FifoTaxSummary>(`${this.base}/tax-summary/${year}`);
  }

  // ─── Yearly Summary ───────────────────────────────────────────────────────────

  getYearlySummary(year: number): Observable<YearlySummary> {
    return this.http.get<YearlySummary>(`${this.base}/summary/${year}`);
  }

  // ─── Export ───────────────────────────────────────────────────────────────────

  exportReport(payload: ExportReportPayload): Observable<Blob> {
    return this.http.post(`${this.base}/reports/export`, { ...payload, format: 'xlsx' }, {
      responseType: 'blob',
    });
  }

  getReportHistory(): Observable<ReportRecord[]> {
    return this.http.get<ReportRecord[]>(`${this.base}/reports/history`);
  }

  deleteReportRecord(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/reports/history/${id}`);
  }
}

function buildHistoryParams(query: HistoryQueryParams): HttpParams {
  let params = new HttpParams();
  if (query.year !== undefined) params = params.set('year', String(query.year));
  if (query.page !== undefined) params = params.set('page', String(query.page));
  if (query.limit !== undefined) params = params.set('limit', String(query.limit));
  return params;
}
