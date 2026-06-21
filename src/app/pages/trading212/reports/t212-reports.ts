import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Trading212ApiService } from '../../../core/api/trading212-api.service';
import type { ReportRecord } from '../../../core/models/trading212.models';

@Component({
  selector: 'app-t212-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-white">Report History</h1>
          <p class="text-slate-500 text-sm mt-0.5">Previously generated Tax Center reports</p>
        </div>
        <button
          type="button"
          (click)="loadHistory()"
          class="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          Refresh
        </button>
      </div>

      @if (historyError()) {
        <div class="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3" role="alert">
          <svg class="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <p class="text-red-300 text-sm">{{ historyError() }}</p>
        </div>
      }

      @if (historyLoading()) {
        <div class="flex items-center justify-center h-32">
          <svg class="w-6 h-6 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      }

      @if (!historyLoading()) {
        @if (history().length === 0) {
          <div class="bg-slate-800/60 border border-slate-700/60 rounded-xl p-10 text-center">
            <p class="text-slate-500 text-sm">No reports generated yet. Generate reports from Tax Center.</p>
          </div>
        } @else {
          <div class="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-slate-700/60">
                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Generated At</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tax Year</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Version</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Realized P&L</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (record of history(); track record._id) {
                    <tr class="border-b border-slate-700/40 last:border-0">
                      <td class="px-4 py-3 text-slate-300 font-mono text-xs whitespace-nowrap">{{ formatDateTime(record.generatedAt) }}</td>
                      <td class="px-4 py-3 text-white font-semibold">{{ record.year }}</td>
                      <td class="px-4 py-3">
                        <span class="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded-full font-mono">{{ record.reportVersion }}</span>
                      </td>
                      <td class="px-4 py-3 text-right font-mono font-semibold"
                        [class]="record.realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'">
                        {{ formatCurrency(record.realizedPnl) }}
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            (click)="deleteRecord(record)"
                            [disabled]="deletingId() === record._id"
                            class="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-red-400 text-xs font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                            aria-label="Delete report record for {{ record.year }}"
                          >
                            @if (deletingId() === record._id) {
                              <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            } @else {
                              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            }
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class T212ReportsPage implements OnInit {
  private readonly api = inject(Trading212ApiService);

  readonly historyLoading = signal(false);
  readonly historyError = signal('');
  readonly history = signal<ReportRecord[]>([]);
  readonly deletingId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.historyLoading.set(true);
    this.historyError.set('');
    this.api.getReportHistory().subscribe({
      next: records => {
        this.history.set(records);
        this.historyLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.historyError.set(this.extractMessage(err, 'Failed to load report history.'));
        this.historyLoading.set(false);
      },
    });
  }

  deleteRecord(record: ReportRecord): void {
    this.deletingId.set(record._id);
    this.api.deleteReportRecord(record._id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.loadHistory();
      },
      error: (err: HttpErrorResponse) => {
        this.historyError.set(this.extractMessage(err, 'Delete failed. Please try again.'));
        this.deletingId.set(null);
      },
    });
  }

  formatDateTime(iso: string): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  }

  formatCurrency(val: number): string {
    return val.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private extractMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string | string[] } | null;
    if (!body) return fallback;
    const msg = body.message;
    if (Array.isArray(msg)) return msg.join(' ');
    return msg ?? fallback;
  }
}
