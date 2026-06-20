import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Trading212ApiService } from '../../../core/api/trading212-api.service';
import { BadgeComponent } from '../../../shared/ui/badge/badge';
import type { T212Order } from '../../../core/models/trading212.models';
import type { BadgeVariant } from '../../../shared/ui/badge/badge';

@Component({
  selector: 'app-t212-orders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  templateUrl: './t212-orders.html',
})
export class T212OrdersPage implements OnInit {
  private readonly api = inject(Trading212ApiService);

  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  readonly selectedYear = signal(new Date().getFullYear());

  readonly loading = signal(true);
  readonly error = signal('');
  readonly orders = signal<T212Order[]>([]);
  readonly total = signal(0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getOrders({ year: this.selectedYear(), limit: 200 }).subscribe({
      next: result => {
        this.orders.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.extractMessage(err, 'Failed to load orders.'));
        this.loading.set(false);
      },
    });
  }

  onYearChange(event: Event): void {
    this.selectedYear.set(Number((event.target as HTMLSelectElement).value));
    this.load();
  }

  sideBadge(side: string): BadgeVariant {
    return side === 'BUY' ? 'running' : 'error';
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB');
  }

  formatNum(val: number | null | undefined, digits = 2): string {
    if (val == null) return '—';
    return val.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  private extractMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string | string[] } | null;
    if (!body) return fallback;
    const msg = body.message;
    if (Array.isArray(msg)) return msg.join(' ');
    return msg ?? fallback;
  }
}
