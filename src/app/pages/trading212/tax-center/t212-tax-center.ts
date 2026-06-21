import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Trading212ApiService } from '../../../core/api/trading212-api.service';
import { BadgeComponent, type BadgeVariant } from '../../../shared/ui/badge/badge';
import type {
  TaxCenterResponse,
  TaxCenterWarning,
  TaxCenterYear,
} from '../../../core/models/trading212.models';

@Component({
  selector: 'app-t212-tax-center',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, RouterLink],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-xl font-semibold text-white">Tax Center</h1>
            <app-badge [label]="environmentLabel()" [variant]="environmentBadge()" />
          </div>
          <p class="text-slate-500 text-sm mt-0.5">Yearly accountant/tax overview</p>
        </div>
        <button
          type="button"
          (click)="load()"
          [disabled]="loading()"
          class="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-sm rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          Refresh
        </button>
      </div>

      @if (error()) {
        <div class="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3" role="alert">
          <svg class="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <p class="text-red-300 text-sm">{{ error() }}</p>
        </div>
      }

      @if (actionMessage()) {
        <div class="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm" role="status">
          {{ actionMessage() }}
        </div>
      }

      @if (actionError()) {
        <div class="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3" role="alert">
          <svg class="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <p class="text-red-300 text-sm">{{ actionError() }}</p>
        </div>
      }

      @if (loading()) {
        <div class="flex items-center justify-center h-48">
          <svg class="w-6 h-6 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      }

      @if (!loading()) {
        @if (years().length === 0) {
          <div class="bg-slate-800/60 border border-slate-700/60 rounded-xl p-12 text-center">
            <svg class="w-8 h-8 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1m9-5a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p class="text-slate-500 text-sm">Sync your Trading212 account to build your Tax Center.</p>
          </div>
        } @else {
          <section class="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden" aria-labelledby="tax-years-title">
            <div class="px-4 py-3 border-b border-slate-700/60">
              <h2 id="tax-years-title" class="text-base font-semibold text-white">Yearly Overview</h2>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm min-w-[1180px]">
                <thead>
                  <tr class="border-b border-slate-700/60">
                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Year</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Realized P&amp;L EUR</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider" title="FIFO cost basis for shares sold during the selected tax year." aria-label="Cost Basis of Sold Shares EUR. FIFO cost basis for shares sold during the selected tax year.">Cost Basis of Sold Shares EUR</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider" title="Gross proceeds from sell executions during the selected tax year." aria-label="Sell Proceeds EUR. Gross proceeds from sell executions during the selected tax year.">Sell Proceeds EUR</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Dividends EUR</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Deposits EUR</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Withdrawals EUR</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Fees EUR</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Orders</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Reports</th>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Latest Report</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-700/40">
                  @for (year of years(); track year.year) {
                    <tr class="hover:bg-slate-700/20">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                          <span class="text-white font-semibold">{{ year.year }}</span>
                          @if (year.hasWarnings) {
                            <app-badge label="Warnings" variant="warning" />
                          }
                        </div>
                      </td>
                      <td class="px-4 py-3 text-right font-mono font-semibold" [class]="year.realizedPnlEur >= 0 ? 'text-emerald-400' : 'text-red-400'">{{ formatCurrency(year.realizedPnlEur) }}</td>
                      <td class="px-4 py-3 text-slate-300 text-right font-mono">{{ formatCurrency(year.costBasisEur) }}</td>
                      <td class="px-4 py-3 text-slate-300 text-right font-mono">{{ formatCurrency(year.proceedsEur) }}</td>
                      <td class="px-4 py-3 text-slate-300 text-right font-mono">{{ formatCurrency(year.dividendsEur) }}</td>
                      <td class="px-4 py-3 text-slate-300 text-right font-mono">{{ formatCurrency(year.depositsEur) }}</td>
                      <td class="px-4 py-3 text-slate-300 text-right font-mono">{{ formatCurrency(year.withdrawalsEur) }}</td>
                      <td class="px-4 py-3 text-slate-300 text-right font-mono">{{ formatCurrency(year.feesEur) }}</td>
                      <td class="px-4 py-3 text-slate-300 text-right font-mono">{{ formatCount(year.ordersCount) }}</td>
                      <td class="px-4 py-3 text-slate-300 text-right font-mono">{{ formatCount(year.reportsCount) }}</td>
                      <td class="px-4 py-3 text-slate-400 whitespace-nowrap font-mono text-xs">{{ formatDate(year.latestReportDate) }}</td>
                      <td class="px-4 py-3">
                        <div class="flex items-center justify-end gap-2">
                          <a
                            routerLink="/trading212/tax-summary"
                            [queryParams]="taxSummaryQueryParams(year.year)"
                            class="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
                            [attr.aria-label]="'View tax summary for ' + year.year"
                          >
                            View Tax Summary
                          </a>
                          <button
                            type="button"
                            (click)="generateReport(year)"
                            [disabled]="generatingYear() === year.year"
                            class="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            [attr.aria-label]="'Generate Excel report for ' + year.year"
                          >
                            {{ generatingYear() === year.year ? 'Generating...' : 'Generate Excel Report' }}
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }

        <section class="space-y-4" aria-labelledby="tax-warnings-title">
          <div>
            <h2 id="tax-warnings-title" class="text-base font-semibold text-white">Warnings</h2>
            <p class="text-slate-500 text-sm mt-0.5">Backend checks that may need review before filing.</p>
          </div>

          @if (warnings().length === 0) {
            <div class="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6">
              <p class="text-slate-500 text-sm">No tax warnings for the active environment.</p>
            </div>
          } @else {
            <div class="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr class="border-b border-slate-700/60">
                      <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Severity</th>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                      <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Message</th>
                      <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Count</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-700/40">
                    @for (warning of warnings(); track warning.code) {
                      <tr class="hover:bg-slate-700/20">
                        <td class="px-4 py-3">
                          <app-badge [label]="warning.severity" [variant]="warningBadge(warning)" />
                        </td>
                        <td class="px-4 py-3 text-slate-300 font-mono text-xs">{{ warning.code }}</td>
                        <td class="px-4 py-3 text-slate-300">{{ warning.message }}</td>
                        <td class="px-4 py-3 text-slate-300 text-right font-mono">{{ formatCount(warning.count) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class T212TaxCenterPage implements OnInit {
  private readonly api = inject(Trading212ApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly actionMessage = signal('');
  readonly taxCenter = signal<TaxCenterResponse | null>(null);
  readonly generatingYear = signal<number | null>(null);

  readonly years = computed(() => this.taxCenter()?.years ?? []);
  readonly warnings = computed(() => this.taxCenter()?.warnings ?? []);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getTaxCenter().subscribe({
      next: taxCenter => {
        this.taxCenter.set(taxCenter);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.extractMessage(err, 'Failed to load Tax Center.'));
        this.loading.set(false);
      },
    });
  }

  generateReport(year: TaxCenterYear): void {
    this.generatingYear.set(year.year);
    this.actionError.set('');
    this.actionMessage.set('');
    this.api.exportReport({ year: year.year, format: 'xlsx' }).subscribe({
      next: blob => {
        this.downloadBlob(blob, `trading212-tax-report-${year.year}.xlsx`);
        this.generatingYear.set(null);
        this.actionMessage.set(`Excel report generated for ${year.year}.`);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.actionError.set(this.extractMessage(err, `Failed to generate report for ${year.year}.`));
        this.generatingYear.set(null);
      },
    });
  }

  taxSummaryQueryParams(year: number): { year: number } {
    return { year };
  }

  environmentLabel(): string {
    const env = this.taxCenter()?.environment;
    if (env === 'live') return 'Live';
    if (env === 'demo') return 'Demo';
    return 'Unknown';
  }

  environmentBadge(): BadgeVariant {
    return this.taxCenter()?.environment === 'live' ? 'live' : 'demo';
  }

  warningBadge(warning: TaxCenterWarning): BadgeVariant {
    const severity = warning.severity.toLowerCase();
    if (severity === 'critical' || severity === 'error') return 'critical';
    if (severity === 'warning') return 'warning';
    return 'default';
  }

  formatCurrency(val: number | null | undefined): string {
    if (val == null) return '-';
    return val.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  formatCount(val: number | null | undefined): string {
    if (val == null) return '-';
    return val.toLocaleString('en-GB');
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '-';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB');
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
