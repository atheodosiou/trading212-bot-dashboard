import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Trading212ApiService } from '../../../core/api/trading212-api.service';
import { getDisplayTicker, getInternalTicker } from '../../../core/models/ticker-display';
import { CardComponent } from '../../../shared/ui/card/card';
import type { FifoTaxSummary, MatchedLot, TickerTaxSummary } from '../../../core/models/trading212.models';

@Component({
  selector: 'app-t212-tax-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  templateUrl: './t212-tax-summary.html',
})
export class T212TaxSummaryPage implements OnInit {
  private readonly api = inject(Trading212ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  readonly selectedYear = signal(new Date().getFullYear());

  readonly loading = signal(true);
  readonly error = signal('');
  readonly summary = signal<FifoTaxSummary | null>(null);
  readonly expandedTickers = signal(new Set<string>());

  ngOnInit(): void {
    const year = Number(this.route.snapshot.queryParamMap.get('year'));
    if (Number.isInteger(year) && year > 0) {
      this.selectedYear.set(year);
    }
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

  toggleTicker(row: TickerTaxSummary): void {
    const ticker = this.tickerKey(row);
    const next = new Set(this.expandedTickers());
    if (next.has(ticker)) {
      next.delete(ticker);
    } else {
      next.add(ticker);
    }
    this.expandedTickers.set(next);
  }

  isExpanded(row: TickerTaxSummary): boolean {
    return this.expandedTickers().has(this.tickerKey(row));
  }

  displayTicker(row: TickerTaxSummary): string {
    return getDisplayTicker(row);
  }

  tickerTitle(row: TickerTaxSummary): string {
    const internalTicker = getInternalTicker(row);
    const parts = [
      row.instrumentName,
      row.instrumentIsin,
      internalTicker ? `Internal ticker: ${internalTicker}` : null,
    ];
    return parts.filter((part): part is string => Boolean(part)).join(' | ');
  }

  internalTicker(row: TickerTaxSummary): string | null {
    return getInternalTicker(row);
  }

  matchedLots(row: TickerTaxSummary): MatchedLot[] {
    const summary = this.summary();
    if (!summary) return [];

    const rowKey = this.tickerKey(row);
    return summary.matchedLots.filter(lot => this.tickerKey(lot) === rowKey);
  }

  lotTitle(lot: MatchedLot): string {
    const internalTicker = getInternalTicker(lot);
    const displayTicker = getDisplayTicker(lot);
    return internalTicker ? `${displayTicker} | Internal ticker: ${internalTicker}` : displayTicker;
  }

  formatCurrency(val: number | null | undefined, currency = 'EUR'): string {
    if (val == null) return '—';
    const cls = val >= 0 ? '' : '';
    void cls;
    return val.toLocaleString('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatNum(val: number | null | undefined, digits = 2): string {
    if (val == null) return '—';
    return val.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  formatQuantity(val: number | null | undefined): string {
    if (val == null) return 'â€”';
    return val.toLocaleString('en-GB', { maximumFractionDigits: 4 });
  }

  formatPrice(val: number | null | undefined): string {
    return this.formatNum(val, 2);
  }

  formatSigned(val: number | null | undefined): string {
    if (val == null) return 'â€”';
    const sign = val > 0 ? '+' : '';
    return `${sign}${this.formatNum(val, 2)}`;
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

  private tickerKey(item: Pick<TickerTaxSummary | MatchedLot, 'ticker' | 'internalTicker' | 'displayTicker'>): string {
    return item.internalTicker?.trim() || item.ticker?.trim() || item.displayTicker?.trim() || '';
  }
}
