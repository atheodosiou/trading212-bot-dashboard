import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Trading212ApiService } from '../../../core/api/trading212-api.service';
import { CardComponent } from '../../../shared/ui/card/card';
import type { FifoTaxSummary } from '../../../core/models/trading212.models';

@Component({
  selector: 'app-t212-tax-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  templateUrl: './t212-tax-summary.html',
})
export class T212TaxSummaryPage implements OnInit {
  private readonly api = inject(Trading212ApiService);

  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  readonly selectedYear = signal(new Date().getFullYear());

  readonly loading = signal(true);
  readonly error = signal('');
  readonly summary = signal<FifoTaxSummary | null>(null);
  readonly expandedTickers = signal(new Set<string>());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getTaxSummary(this.selectedYear()).subscribe({
      next: result => {
        this.summary.set(result);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.extractMessage(err, 'Failed to load tax summary.'));
        this.loading.set(false);
      },
    });
  }

  onYearChange(event: Event): void {
    this.selectedYear.set(Number((event.target as HTMLSelectElement).value));
    this.load();
  }

  toggleTicker(ticker: string): void {
    const next = new Set(this.expandedTickers());
    if (next.has(ticker)) {
      next.delete(ticker);
    } else {
      next.add(ticker);
    }
    this.expandedTickers.set(next);
  }

  isExpanded(ticker: string): boolean {
    return this.expandedTickers().has(ticker);
  }

  formatCurrency(val: number | null | undefined): string {
    if (val == null) return '—';
    const cls = val >= 0 ? '' : '';
    void cls;
    return val.toLocaleString('en-GB', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  }

  formatNum(val: number | null | undefined, digits = 2): string {
    if (val == null) return '—';
    return val.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB');
  }

  private extractMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string | string[] } | null;
    if (!body) return fallback;
    const msg = body.message;
    if (Array.isArray(msg)) return msg.join(' ');
    return msg ?? fallback;
  }
}
