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
    <div class="space-y-8">

      <!-- ── Generate section ──────────────────────────────────────────────── -->
      <div class="space-y-5 max-w-xl">
        <div>
          <h1 class="text-xl font-semibold text-white">Export Report</h1>
          <p class="text-slate-500 text-sm mt-0.5">Generate an Excel file for your accountant</p>
        </div>

        @if (exportError()) {
          <div class="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3" role="alert">
            <svg class="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <p class="text-red-300 text-sm">{{ exportError() }}</p>
          </div>
        }

        @if (downloaded()) {
          <div class="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm">
            Report downloaded — history updated below.
          </div>
        }

        <div class="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6 space-y-5">
          <div>
            <label for="report-year" class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tax Year</label>
            <select
              id="report-year"
              [value]="selectedYear()"
              (change)="onYearChange($event)"
              class="w-full bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              @for (y of years; track y) {
                <option [value]="y">{{ y }}</option>
              }
            </select>
          </div>

          <button
            type="button"
            (click)="exportReport()"
            [disabled]="exporting()"
            class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            @if (exporting()) {
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Generating report…
            } @else {
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Download Excel Report ({{ selectedYear() }})
            }
          </button>
        </div>

        <div class="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 space-y-3 text-sm text-slate-400">
          <p class="font-semibold text-slate-300">What's included in the Excel report?</p>
          <ul class="space-y-1.5 list-disc list-inside">
            <li>Summary sheet — P&L, dividends, cash flows at a glance</li>
            <li>Orders — all buy/sell executions for the year</li>
            <li>Realized Trades (FIFO) — matched lots with cost basis and gain/loss</li>
            <li>Dividends — all dividend payments received</li>
            <li>Cash Transactions — deposits, withdrawals, and fees</li>
            <li>Open Positions — current holdings with FIFO cost basis</li>
            <li>Tax Summary — totals ready for your accountant or tax return</li>
            <li>Notes — methodology and data sources</li>
          </ul>
        </div>
      </div>

      <!-- ── Report History ─────────────────────────────────────────────────── -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-white">Report History</h2>
            <p class="text-slate-500 text-sm mt-0.5">Previously generated reports</p>
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
              <p class="text-slate-500 text-sm">No reports generated yet. Download your first report above.</p>
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
                            <!-- Regenerate -->
                            <button
                              type="button"
                              (click)="regenerate(record)"
                              [disabled]="regeneratingId() === record._id || deletingId() === record._id"
                              class="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-blue-400 text-xs font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                              aria-label="Regenerate report for {{ record.year }}"
                            >
                              @if (regeneratingId() === record._id) {
                                <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                              } @else {
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                </svg>
                              }
                              Regenerate
                            </button>

                            <!-- Delete -->
                            <button
                              type="button"
                              (click)="deleteRecord(record)"
                              [disabled]="deletingId() === record._id || regeneratingId() === record._id"
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

    </div>
  `,
})
export class T212ReportsPage implements OnInit {
  private readonly api = inject(Trading212ApiService);

  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Generate form state
  readonly selectedYear = signal(new Date().getFullYear());
  readonly exporting = signal(false);
  readonly exportError = signal('');
  readonly downloaded = signal(false);

  // History table state
  readonly historyLoading = signal(false);
  readonly historyError = signal('');
  readonly history = signal<ReportRecord[]>([]);
  readonly deletingId = signal<string | null>(null);
  readonly regeneratingId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadHistory();
  }

  onYearChange(event: Event): void {
    this.selectedYear.set(Number((event.target as HTMLSelectElement).value));
    this.downloaded.set(false);
  }

  exportReport(): void {
    this.exporting.set(true);
    this.exportError.set('');
    this.downloaded.set(false);
    this.api.exportReport({ year: this.selectedYear(), format: 'xlsx' }).subscribe({
      next: blob => {
        this.downloadBlob(blob, `trading212-tax-report-${this.selectedYear()}.xlsx`);
        this.exporting.set(false);
        this.downloaded.set(true);
        this.loadHistory();
      },
      error: (err: HttpErrorResponse) => {
        this.exportError.set(this.extractMessage(err, 'Export failed. Please try again.'));
        this.exporting.set(false);
      },
    });
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

  regenerate(record: ReportRecord): void {
    this.regeneratingId.set(record._id);
    this.exportError.set('');
    this.api.exportReport({ year: record.year, format: 'xlsx' }).subscribe({
      next: blob => {
        this.downloadBlob(blob, `trading212-tax-report-${record.year}.xlsx`);
        this.regeneratingId.set(null);
        this.loadHistory();
      },
      error: (err: HttpErrorResponse) => {
        this.exportError.set(this.extractMessage(err, `Regeneration failed for ${record.year}.`));
        this.regeneratingId.set(null);
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
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  }

  formatCurrency(val: number): string {
    return val.toLocaleString('en-GB', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private extractMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string | string[] } | null;
    if (!body) return fallback;
    const msg = body.message;
    if (Array.isArray(msg)) return msg.join(' ');
    return msg ?? fallback;
  }
}
