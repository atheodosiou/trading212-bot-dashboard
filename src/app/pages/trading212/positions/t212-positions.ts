import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Trading212ApiService } from '../../../core/api/trading212-api.service';
import type { OpenPosition } from '../../../core/models/trading212.models';

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

  toggleExpanded(ticker: string): void {
    const next = new Set(this.expanded());
    if (next.has(ticker)) {
      next.delete(ticker);
    } else {
      next.add(ticker);
    }
    this.expanded.set(next);
  }

  isExpanded(ticker: string): boolean {
    return this.expanded().has(ticker);
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
