import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap, takeUntil } from 'rxjs';
import {
  AnalysisApiService,
  type AnalysisInstrumentSearchResult,
} from '../../core/api/analysis-api.service';
import { MarketIndicesApiService } from '../../core/api/market-indices-api.service';
import type {
  IndexConstituent,
  IndexDashboard,
  IndexDetails,
  IndexHistoryPoint,
  IndexStatus,
  RebalanceCustomIndexRequest,
  WeightingMethod,
} from '../../core/api/models/market-indices-api.model';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog';

const DEFAULT_MAX_WEIGHT_RATIO = 0.25;
const DEFAULT_MAX_WEIGHT_PERCENT = 25;

@Component({
  selector: 'app-market-index-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, ConfirmDialogComponent],
  template: `
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <a routerLink="/market-indices" class="text-sm font-semibold text-blue-300 hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500">Back to Market Indices</a>
          <h1 class="mt-2 text-xl font-semibold text-white">{{ details()?.name || 'Market Index' }}</h1>
          @if (details()?.description) {
            <p class="mt-0.5 text-sm text-slate-500">{{ details()?.description }}</p>
          }
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" (click)="load()" class="rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500">Reload</button>
          <button type="button" (click)="refresh()" class="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500">Refresh Index</button>
          @if (canManage()) {
            <button type="button" (click)="openRebalance()" class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500">Rebalance</button>
            <button type="button" (click)="deleteOpen.set(true)" class="rounded-lg bg-red-600/20 px-3 py-2 text-sm font-semibold text-red-200 transition-colors hover:bg-red-600/30 focus:outline-none focus:ring-2 focus:ring-red-500">Delete</button>
          }
        </div>
      </div>

      @if (message()) {
        <div class="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-200" role="status">{{ message() }}</div>
      }
      @if (error()) {
        <div class="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300" role="alert">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="flex h-48 items-center justify-center">
          <svg class="h-6 w-6 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        </div>
      } @else if (displayDashboard(); as dash) {
        <section class="grid gap-4 md:grid-cols-4">
          <div class="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Latest Value</p>
            <p class="mt-2 text-2xl font-semibold text-white">{{ formatNumber(dash.latestValue) }}</p>
          </div>
          <div class="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Daily Return</p>
            <p class="mt-2 text-2xl font-semibold" [class]="returnClass(dash.dailyReturn)">{{ formatPercent(dash.dailyReturn) }}</p>
          </div>
          <div class="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
            <p class="mt-3"><span class="rounded-full border px-2.5 py-1 text-xs font-semibold" [class]="statusClass(dash.health.status)">{{ dash.health.status }}</span></p>
          </div>
          <div class="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Constituents</p>
            <p class="mt-2 text-2xl font-semibold text-white">{{ dash.summary.constituents }}</p>
          </div>
        </section>

        <section class="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <div class="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <h2 class="text-sm font-semibold text-white">History</h2>
              <p class="text-xs text-slate-500">{{ dash.history.length }} point(s)</p>
            </div>
            @if (dash.history.length === 0) {
              <div class="flex h-64 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/50 text-sm text-slate-500">No history available.</div>
            } @else {
              <svg class="h-64 w-full overflow-visible" viewBox="0 0 640 220" role="img" aria-label="Index history chart">
                <line x1="0" y1="190" x2="640" y2="190" stroke="#334155" stroke-width="1" />
                <polyline [attr.points]="chartPoints(dash.history)" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            }
          </div>

          <div class="space-y-4">
            <div class="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
              <h2 class="mb-3 text-sm font-semibold text-white">Summary</h2>
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between gap-4"><dt class="text-slate-500">Best Performer</dt><dd class="font-semibold text-slate-200">{{ dash.summary.bestPerformer || '-' }}</dd></div>
                <div class="flex justify-between gap-4"><dt class="text-slate-500">Worst Performer</dt><dd class="font-semibold text-slate-200">{{ dash.summary.worstPerformer || '-' }}</dd></div>
                <div class="flex justify-between gap-4"><dt class="text-slate-500">Largest Weight</dt><dd class="font-semibold text-slate-200">{{ dash.summary.largestWeight || '-' }}</dd></div>
              </dl>
            </div>
            <div class="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
              <h2 class="mb-3 text-sm font-semibold text-white">Health</h2>
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between gap-4"><dt class="text-slate-500">Price Coverage</dt><dd class="font-mono text-slate-200">{{ formatPercent(dash.health.priceCoverage) }}</dd></div>
                <div class="flex justify-between gap-4"><dt class="text-slate-500">Profile Coverage</dt><dd class="font-mono text-slate-200">{{ formatPercent(dash.health.profileCoverage) }}</dd></div>
                <div class="flex justify-between gap-4"><dt class="text-slate-500">Last Refresh</dt><dd class="text-slate-200">{{ formatDateTime(dash.health.lastRefresh) }}</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
            <h2 class="mb-3 text-sm font-semibold text-white">Top Contributors</h2>
            <div class="space-y-2">
              @for (item of dash.topContributors; track item.symbol) {
                <div class="flex justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-sm"><span class="font-semibold text-slate-200">{{ item.symbol }}</span><span class="font-mono text-emerald-300">{{ formatPercent(item.contribution) }}</span></div>
              } @empty {
                <p class="text-sm text-slate-500">No contributors available.</p>
              }
            </div>
          </div>
          <div class="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
            <h2 class="mb-3 text-sm font-semibold text-white">Top Detractors</h2>
            <div class="space-y-2">
              @for (item of dash.topDetractors; track item.symbol) {
                <div class="flex justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-sm"><span class="font-semibold text-slate-200">{{ item.symbol }}</span><span class="font-mono text-red-300">{{ formatPercent(item.contribution) }}</span></div>
              } @empty {
                <p class="text-sm text-slate-500">No detractors available.</p>
              }
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-slate-700/60 bg-slate-800/60 p-4">
          <h2 class="mb-3 text-sm font-semibold text-white">Data Quality</h2>
          <div class="grid gap-4 text-sm md:grid-cols-4">
            <div><p class="text-slate-500">Missing Profiles</p><p class="mt-1 font-semibold text-slate-200">{{ dash.dataQuality.missingProfiles.length }}</p></div>
            <div><p class="text-slate-500">Missing Prices</p><p class="mt-1 font-semibold text-slate-200">{{ dash.dataQuality.missingPrices.length }}</p></div>
            <div><p class="text-slate-500">Used Cached Data</p><p class="mt-1 font-semibold text-slate-200">{{ dash.dataQuality.usedCachedData ? 'Yes' : 'No' }}</p></div>
            <div><p class="text-slate-500">Provider Calls</p><p class="mt-1 font-semibold text-slate-200">{{ dash.dataQuality.providerCallsUsed }} / {{ dash.dataQuality.providerCallsRemaining ?? '-' }}</p></div>
          </div>
        </section>

        <section class="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-800/60">
          <div class="border-b border-slate-700/60 px-4 py-3">
            <h2 class="text-sm font-semibold text-white">Constituents</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-700/60">
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Symbol</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Company</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Weight</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Raw Weight</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Daily Return</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Contribution</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Market Cap</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Source</th>
                </tr>
              </thead>
              <tbody>
                @for (row of dash.constituents; track row.symbol) {
                  <tr class="border-b border-slate-700/40">
                    <td class="px-4 py-3 font-semibold text-white">{{ row.symbol }}</td>
                    <td class="px-4 py-3 text-slate-300">{{ row.companyName || '-' }}</td>
                    <td class="px-4 py-3 text-right font-mono text-slate-200">{{ formatPercent(row.weight) }}</td>
                    <td class="px-4 py-3 text-right font-mono text-slate-300">{{ formatPercent(row.rawWeight) }}</td>
                    <td class="px-4 py-3 text-right font-mono" [class]="returnClass(row.dailyReturn)">{{ formatPercent(row.dailyReturn) }}</td>
                    <td class="px-4 py-3 text-right font-mono" [class]="returnClass(row.contribution)">{{ formatPercent(row.contribution) }}</td>
                    <td class="px-4 py-3 text-right font-mono text-slate-300">{{ formatCompact(row.marketCap) }}</td>
                    <td class="px-4 py-3 text-slate-300">{{ dataSourceLabel(row.dataSource) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      @if (rebalanceOpen()) {
        <div class="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="rebalance-title">
          <div class="absolute inset-0 bg-black/70" (click)="closeRebalance()"></div>
          <div class="relative w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-2xl">
            <div class="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="rebalance-title" class="text-lg font-semibold text-white">Rebalance Index</h2>
                <p class="mt-1 text-sm text-slate-500">Submit the desired constituent set for backend processing.</p>
              </div>
              <button type="button" (click)="closeRebalance()" class="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500" aria-label="Close rebalance dialog">x</button>
            </div>
            <form [formGroup]="rebalanceForm" (ngSubmit)="submitRebalance()" class="space-y-4">
              <div class="grid gap-4 md:grid-cols-4">
                <label class="block md:col-span-2">
                  <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Weighting</span>
                  <select formControlName="weightingMethod" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="market_cap_capped">Market cap capped</option>
                    <option value="equal_weight">Equal weight</option>
                  </select>
                </label>
                <label class="block">
                  <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Max Weight (%)</span>
                  <input type="number" min="5" max="100" step="1" formControlName="maxWeightPercent" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label class="block">
                  <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Effective Date</span>
                  <input type="date" formControlName="effectiveDate" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
              </div>

              <div>
                <label for="rebalance-symbol-search" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Symbols</label>
                <input id="rebalance-symbol-search" type="search" [value]="symbolQuery()" (input)="onSymbolSearch($event)" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search by company or ticker" role="combobox" autocomplete="off" aria-autocomplete="list" aria-controls="rebalance-symbol-results" [attr.aria-expanded]="showSymbolResults()" />
                @if (showSymbolResults()) {
                  <div id="rebalance-symbol-results" class="mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl" role="listbox">
                    @for (result of symbolResults(); track result.internalTicker || result.displayTicker || result.ticker || $index) {
                      <button type="button" (click)="addSymbol(result)" class="block w-full px-4 py-3 text-left hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" role="option">
                        <span class="block text-sm font-semibold text-white">{{ resultSymbol(result) }}</span>
                        <span class="block text-sm text-slate-300">{{ resultName(result) }}</span>
                      </button>
                    }
                  </div>
                }
                <div class="mt-3 flex flex-wrap gap-2">
                  @for (symbol of symbols(); track symbol) {
                    <button type="button" (click)="removeSymbol(symbol)" class="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500" [attr.aria-label]="'Remove ' + symbol">{{ symbol }} <span aria-hidden="true">x</span></button>
                  }
                </div>
              </div>

              @if (rebalanceError()) {
                <p class="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300" role="alert">{{ rebalanceError() }}</p>
              }

              <div class="flex justify-end gap-3">
                <button type="button" (click)="closeRebalance()" class="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500">Cancel</button>
                <button type="submit" [disabled]="rebalanceSaving()" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500">Rebalance</button>
              </div>
            </form>
          </div>
        </div>
      }

      <app-confirm-dialog
        [open]="deleteOpen()"
        title="Delete market index"
        [message]="'Delete ' + (details()?.name ?? 'this index') + '?'"
        warningText="This is a soft delete. The index will no longer appear in active lists."
        [danger]="true"
        confirmLabel="Delete"
        dialogId="delete-market-index-dashboard"
        (confirmed)="deleteConfirmed()"
        (cancelled)="deleteOpen.set(false)"
      />
    </div>
  `,
})
export class MarketIndexDashboardPage implements OnInit, OnDestroy {
  private readonly api = inject(MarketIndicesApiService);
  private readonly analysisApi = inject(AnalysisApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly symbolTerms = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private pollHandle: ReturnType<typeof setTimeout> | null = null;

  readonly id = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal('');
  readonly dashboard = signal<IndexDashboard | null>(null);
  readonly displayDashboard = computed(() => {
    const dashboard = this.dashboard();
    if (!dashboard) return null;
    const usedCachedData = dashboard.dataQuality.usedCachedData
      || dashboard.constituents.some(row => row.dataSource === 'cache');
    return {
      ...dashboard,
      dataQuality: {
        ...dashboard.dataQuality,
        usedCachedData,
      },
    };
  });
  readonly details = signal<IndexDetails | null>(null);
  readonly rebalanceOpen = signal(false);
  readonly rebalanceSaving = signal(false);
  readonly rebalanceError = signal('');
  readonly deleteOpen = signal(false);
  readonly symbols = signal<string[]>([]);
  readonly symbolQuery = signal('');
  readonly symbolResults = signal<AnalysisInstrumentSearchResult[]>([]);
  readonly showSymbolResults = signal(false);

  readonly isAdmin = computed(() => this.hasAdminCapability());
  readonly canManage = computed(() => {
    const details = this.details();
    return details ? details.visibility === 'user' || this.isAdmin() : true;
  });

  readonly rebalanceForm = this.fb.nonNullable.group({
    weightingMethod: ['market_cap_capped' as WeightingMethod],
    maxWeightPercent: [DEFAULT_MAX_WEIGHT_PERCENT, [Validators.min(5), Validators.max(100)]],
    effectiveDate: [''],
  });

  constructor() {
    this.symbolTerms.pipe(
      map(term => term.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      filter(term => {
        if (term.length >= 2) return true;
        this.symbolResults.set([]);
        this.showSymbolResults.set(false);
        return false;
      }),
      switchMap(term => this.analysisApi.searchInstruments(term).pipe(catchError(() => of([])))),
      takeUntil(this.destroy$),
    ).subscribe(results => {
      this.symbolResults.set(results);
      this.showSymbolResults.set(results.length > 0);
    });
  }

  ngOnInit(): void {
    this.id.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearPoll();
  }

  load(): void {
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.error.set('');
    this.api.getDashboard(id).subscribe({
      next: dashboard => {
        this.dashboard.set(dashboard);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.extractMessage(err, 'Failed to load market index dashboard.'));
        this.loading.set(false);
      },
    });
    this.api.getIndex(id).subscribe({
      next: details => this.details.set(details),
      error: () => this.details.set(null),
    });
  }

  refresh(): void {
    const id = this.id();
    this.api.refreshIndex(id).subscribe({
      next: response => {
        this.message.set(`Refresh started (${response.status}).`);
        this.pollDashboard();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.extractMessage(err, 'Refresh failed. You may not have permission to refresh this index.'));
      },
    });
  }

  openRebalance(): void {
    const currentSymbols = this.dashboard()?.constituents.map(row => row.symbol) ?? [];
    this.symbols.set(currentSymbols);
    this.rebalanceForm.reset({
      weightingMethod: this.details()?.weightingMethod ?? 'market_cap_capped',
      maxWeightPercent: this.ratioToPercent(this.details()?.maxWeight ?? DEFAULT_MAX_WEIGHT_RATIO),
      effectiveDate: '',
    });
    this.rebalanceError.set('');
    this.rebalanceOpen.set(true);
  }

  closeRebalance(): void {
    this.rebalanceOpen.set(false);
  }

  onSymbolSearch(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.symbolQuery.set(value);
    this.symbolTerms.next(value);
  }

  addSymbol(result: AnalysisInstrumentSearchResult): void {
    const symbol = this.resultSymbol(result);
    if (symbol === '-' || this.symbols().includes(symbol) || this.symbols().length >= 15) return;
    this.symbols.update(symbols => [...symbols, symbol]);
    this.symbolQuery.set('');
    this.symbolResults.set([]);
    this.showSymbolResults.set(false);
  }

  removeSymbol(symbol: string): void {
    this.symbols.update(symbols => symbols.filter(item => item !== symbol));
  }

  submitRebalance(): void {
    if (this.rebalanceForm.invalid || this.symbols().length < 2) {
      this.rebalanceError.set('Add at least 2 symbols and check the weight limits.');
      return;
    }
    this.rebalanceSaving.set(true);
    this.rebalanceError.set('');
    this.api.rebalanceIndex(this.id(), this.rebalancePayload()).subscribe({
      next: response => {
        this.rebalanceSaving.set(false);
        this.rebalanceOpen.set(false);
        this.message.set(`Rebalance started (${response.status}).`);
        this.pollDashboard();
      },
      error: (err: HttpErrorResponse) => {
        this.rebalanceError.set(this.extractMessage(err, 'Rebalance failed. You may not have permission to rebalance this index.'));
        this.rebalanceSaving.set(false);
      },
    });
  }

  deleteConfirmed(): void {
    this.api.deleteIndex(this.id()).subscribe({
      next: () => {
        this.deleteOpen.set(false);
        this.router.navigate(['/market-indices']);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.extractMessage(err, 'Delete failed. You may not have permission to delete this index.'));
        this.deleteOpen.set(false);
      },
    });
  }

  resultSymbol(result: AnalysisInstrumentSearchResult): string {
    return (result.displayTicker?.trim() || result.ticker?.trim() || result.internalTicker?.trim() || '-').toUpperCase();
  }

  resultName(result: AnalysisInstrumentSearchResult): string {
    return result.name?.trim() || 'Unknown company';
  }

  chartPoints(history: IndexHistoryPoint[]): string {
    if (history.length === 1) return `0,110 640,110`;
    const values = history.map(point => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || 1;
    return history.map((point, index) => {
      const x = (index / (history.length - 1)) * 640;
      const y = 190 - ((point.value - min) / spread) * 160;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  formatNumber(value: number | null | undefined): string {
    if (value == null) return '-';
    return value.toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  }

  formatPercent(value: number | null | undefined): string {
    if (value == null) return '-';
    return `${(value * 100).toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
  }

  formatCompact(value: number | null | undefined): string {
    if (value == null) return '-';
    return Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB');
  }

  dataSourceLabel(source: IndexConstituent['dataSource']): string {
    if (source === 'massive') return 'Massive';
    if (source === 'trading212') return 'Trading212';
    return 'Cache';
  }

  returnClass(value: number): string {
    if (value > 0) return 'text-emerald-300';
    if (value < 0) return 'text-red-300';
    return 'text-slate-300';
  }

  statusClass(status: IndexStatus): string {
    if (status === 'READY') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    if (status === 'PARTIAL' || status === 'BUILDING' || status === 'REBALANCING') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300';
    if (status === 'FAILED') return 'border-red-500/30 bg-red-500/10 text-red-300';
    return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
  }

  private pollDashboard(): void {
    this.clearPoll();
    const poll = () => {
      this.api.getDashboard(this.id()).subscribe({
        next: dashboard => {
          this.dashboard.set(dashboard);
          if (dashboard.health.status === 'READY' || dashboard.health.status === 'PARTIAL' || dashboard.health.status === 'FAILED') {
            this.message.set(`Index is ${dashboard.health.status}.`);
            this.load();
            return;
          }
          this.pollHandle = setTimeout(poll, 5000);
        },
        error: () => {
          this.pollHandle = setTimeout(poll, 10000);
        },
      });
    };
    this.pollHandle = setTimeout(poll, 5000);
  }

  private clearPoll(): void {
    if (!this.pollHandle) return;
    clearTimeout(this.pollHandle);
    this.pollHandle = null;
  }

  private rebalancePayload(): RebalanceCustomIndexRequest {
    const value = this.rebalanceForm.getRawValue();
    return {
      symbols: this.symbols(),
      weightingMethod: value.weightingMethod,
      maxWeight: this.percentToRatio(value.maxWeightPercent),
      effectiveDate: value.effectiveDate || undefined,
      reason: 'manual_rebalance',
    };
  }

  private ratioToPercent(value: number): number {
    return value * 100;
  }

  private percentToRatio(value: number): number {
    return value / 100;
  }

  private hasAdminCapability(): boolean {
    const user = this.auth.user();
    return user?.isAdmin === true || user?.roles?.some(role => role.toLowerCase() === 'admin') === true;
  }

  private extractMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string | string[]; error?: string } | null;
    const message = body?.message ?? body?.error;
    if (Array.isArray(message)) return message.join(' ');
    return message || fallback;
  }
}
