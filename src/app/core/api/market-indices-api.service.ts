import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  AsyncIndexOperationResponse,
  CreateCustomIndexRequest,
  DeleteResponse,
  IndexDashboard,
  IndexDetails,
  IndexHistoryPoint,
  IndexListItem,
  IndexVisibility,
  RebalanceCustomIndexRequest,
} from './models/market-indices-api.model';

@Injectable({ providedIn: 'root' })
export class MarketIndicesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/custom-indexes`;

  listIndexes(params?: {
    visibility?: IndexVisibility;
    theme?: string;
    search?: string;
  }): Observable<IndexListItem[]> {
    return this.http.get<IndexListItem[]>(this.base, { params: this.toParams(params) });
  }

  createIndex(body: CreateCustomIndexRequest): Observable<AsyncIndexOperationResponse> {
    return this.http.post<AsyncIndexOperationResponse>(this.base, body);
  }

  getIndex(id: string): Observable<IndexDetails> {
    return this.http.get<IndexDetails>(`${this.base}/${encodeURIComponent(id)}`);
  }

  getDashboard(id: string): Observable<IndexDashboard> {
    return this.http.get<IndexDashboard>(`${this.base}/${encodeURIComponent(id)}/dashboard`);
  }

  getHistory(id: string, params?: { from?: string; to?: string }): Observable<IndexHistoryPoint[]> {
    return this.http.get<IndexHistoryPoint[]>(`${this.base}/${encodeURIComponent(id)}/history`, {
      params: this.toParams(params),
    });
  }

  refreshIndex(id: string): Observable<AsyncIndexOperationResponse> {
    return this.http.post<AsyncIndexOperationResponse>(`${this.base}/${encodeURIComponent(id)}/refresh`, {});
  }

  rebalanceIndex(
    id: string,
    body: RebalanceCustomIndexRequest,
  ): Observable<AsyncIndexOperationResponse> {
    return this.http.post<AsyncIndexOperationResponse>(
      `${this.base}/${encodeURIComponent(id)}/rebalance`,
      body,
    );
  }

  deleteIndex(id: string): Observable<DeleteResponse> {
    return this.http.delete<DeleteResponse>(`${this.base}/${encodeURIComponent(id)}`);
  }

  private toParams(params?: Record<string, string | undefined>): HttpParams {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      const trimmed = value?.trim();
      if (trimmed) httpParams = httpParams.set(key, trimmed);
    }
    return httpParams;
  }
}
