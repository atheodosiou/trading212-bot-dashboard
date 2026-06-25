import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { VixFearGauge } from '../models/vix-fear-gauge.model';

@Injectable({ providedIn: 'root' })
export class ValuationCenterApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getVixFearGauge(): Observable<VixFearGauge> {
    return this.http.get<VixFearGauge>(`${this.base}/market/vix/fear-gauge`);
  }
}
