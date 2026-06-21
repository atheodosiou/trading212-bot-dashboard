import { Injectable, signal } from '@angular/core';
import type { AnalysisReport } from '../../core/api/analysis-api.service';

export interface SelectedInstrument {
  displayTicker: string;
  internalTicker: string;
  name: string;
  isin: string;
  currency: string;
  exchange: string;
}

@Injectable({ providedIn: 'root' })
export class ValuationCenterStateService {
  readonly query = signal('');
  readonly selectedInstrument = signal<SelectedInstrument | null>(null);
  readonly selectedProfileId = signal('');
  readonly report = signal<AnalysisReport | null>(null);
}
