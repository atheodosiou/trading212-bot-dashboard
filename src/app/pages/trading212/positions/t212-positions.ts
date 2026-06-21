import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Trading212ApiService } from '../../../core/api/trading212-api.service';
import { getDisplayTicker, getInternalTicker } from '../../../core/models/ticker-display';
import type { OpenPosition, PositionLot } from '../../../core/models/trading212.models';

@Component({
  selector: 'app-t212-positions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './t212-positions.html',
})
export class T212PositionsPage implements OnInit {
  private readonly api = inject(Trading212ApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly positions = signal<OpenPosition[]>([]);
  readonly expanded = signal(new Set<string>());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getPositions().subscribe({
      next: result => {
        this.positions.set(result);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.extractMessage(err, 'Failed to load positions.'));
        this.loading.set(false);
      },
    });
  }

  toggleExpanded(position: OpenPosition): void {
    const ticker = this.positionKey(position);
    const next = new Set(this.expanded());
    if (next.has(ticker)) {
      next.delete(ticker);
    } else {
      next.add(ticker);
    }
    this.expanded.set(next);
  }

  isExpanded(position: OpenPosition): boolean {
    return this.expanded().has(this.positionKey(position));
  }

  displayTicker(position: OpenPosition): string {
    return getDisplayTicker(position);
  }

  tickerTitle(position: OpenPosition): string {
    const internalTicker = getInternalTicker(position);
    const parts = [
      position.instrumentName,
      position.instrumentIsin,
      internalTicker ? `Internal ticker: ${internalTicker}` : null,
    ];
    return parts.filter((part): part is string => Boolean(part)).join(' | ');
  }

  internalTicker(position: OpenPosition): string | null {
    return getInternalTicker(position);
  }

  lotTotalCostAccount(lot: PositionLot): number {
    return lot.qty * lot.costPerShareAccount;
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

  formatCurrency(val: number | null | undefined, currency: string): string {
    if (val == null) return 'â€”';
    return val.toLocaleString('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  private positionKey(position: OpenPosition): string {
    return position.internalTicker?.trim() || position.ticker?.trim() || position.displayTicker?.trim() || '';
  }
}
