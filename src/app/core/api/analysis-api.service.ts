import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type AnalysisStatus =
  | 'Excellent'
  | 'Strong Candidate'
  | 'Watchlist'
  | 'Speculative'
  | 'Avoid For Now';

export interface AnalysisMetric {
  key?: string | null;
  label?: string | null;
  value: number | null;
  unit?: string | null;
  score?: number | null;
  note?: string | null;
}

export interface AnalysisCategory {
  score: number | null;
  metricsUsed: AnalysisMetric[];
}

export interface AnalysisCategories {
  businessQuality: AnalysisCategory;
  financialHealth: AnalysisCategory;
  valuation: AnalysisCategory;
  momentum: AnalysisCategory;
  risk: AnalysisCategory;
}

export interface AnalysisProfileWeights {
  businessQuality: number;
  financialHealth: number;
  valuation: number;
  momentum: number;
  risk: number;
}

export interface AnalysisProfile {
  id?: string;
  _id?: string;
  profileId?: string;
  name: string;
  weights: AnalysisProfileWeights;
}

export type ResearchMacroAlignment = 'supportive' | 'neutral' | 'restrictive';
export type ResearchOverallView = 'bullish' | 'neutral' | 'bearish';
export type ResearchDriverType = 'positive' | 'negative' | 'warning';
export type ResearchDriverCategory =
  | 'business'
  | 'financial'
  | 'valuation'
  | 'momentum'
  | 'risk'
  | 'macro';

export interface ResearchKeyDriver {
  title: string;
  type: ResearchDriverType;
  category: ResearchDriverCategory;
  explanation: string;
}

export interface ResearchReport {
  macroAlignment: ResearchMacroAlignment;
  overallView: ResearchOverallView;
  confidence: number;
  investmentThesis: string;
  keyDrivers: ResearchKeyDriver[];
}

interface AnalysisProfilesEnvelope {
  profiles?: AnalysisProfile[];
  items?: AnalysisProfile[];
  data?: AnalysisProfile[];
}

export interface AnalysisReport {
  ticker?: string;
  companyName?: string;
  name?: string;
  overallScore: number | null;
  status?: AnalysisStatus | string | null;
  strengths: string[];
  weaknesses: string[];
  categories: AnalysisCategories;
  research?: ResearchReport | null;
  profile?: AnalysisProfile | null;
  generatedAt?: string | null;
  expiresAt?: string | null;
}

export interface AnalysisInstrumentSearchResult {
  ticker?: string | null;
  displayTicker?: string | null;
  internalTicker?: string | null;
  name?: string | null;
  isin?: string | null;
  currency?: string | null;
  exchange?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AnalysisApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/analysis`;

  getReport(ticker: string, profileId?: string): Observable<AnalysisReport> {
    const options = profileId ? { params: new HttpParams().set('profileId', profileId) } : {};
    return this.http.get<AnalysisReport>(`${this.base}/report/${encodeURIComponent(ticker)}`, options);
  }

  getProfiles(): Observable<AnalysisProfile[]> {
    return this.http.get<AnalysisProfile[] | AnalysisProfilesEnvelope>(`${this.base}/profiles`).pipe(
      map(response => {
        if (Array.isArray(response)) return response;
        return response.profiles ?? response.items ?? response.data ?? [];
      }),
    );
  }

  searchInstruments(query: string): Observable<AnalysisInstrumentSearchResult[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<AnalysisInstrumentSearchResult[]>(`${this.base}/search-instruments`, { params });
  }
}
