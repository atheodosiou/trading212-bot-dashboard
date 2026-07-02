import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap, takeUntil } from 'rxjs';
import {
  AnalysisApiService,
  type AnalysisInstrumentSearchResult,
} from '../../core/api/analysis-api.service';
import { MarketIndicesApiService } from '../../core/api/market-indices-api.service';
import type {
  CreateCustomIndexRequest,
  IndexListItem,
  IndexStatus,
  IndexVisibility,
  WeightingMethod,
} from '../../core/api/models/market-indices-api.model';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog/confirm-dialog';

const DEFAULT_MAX_WEIGHT_PERCENT = 25;

@Component({
  selector: 'app-market-indices-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, ConfirmDialogComponent],
  template: `
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-white">Market Indices</h1>
          <p class="mt-0.5 text-sm text-slate-500">Track system and custom baskets built by the backend index engine</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" (click)="load()" class="rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500">
            Refresh
          </button>
          <button type="button" (click)="openCreate('user')" class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500">
            Create Custom Index
          </button>
          @if (isAdmin()) {
            <button type="button" (click)="openCreate('system')" class="rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
              Create System Index
            </button>
          }
        </div>
      </div>

      <form class="grid gap-3 rounded-xl border border-slate-700/60 bg-slate-800/60 p-4 md:grid-cols-[1fr_180px_180px_auto]" (submit)="applyFilters($event)">
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Search</span>
          <input type="search" [value]="search()" (input)="setSearch($event)" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Name or theme" />
        </label>
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Visibility</span>
          <select [value]="visibility()" (change)="setVisibility($event)" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All</option>
            <option value="system">System</option>
            <option value="user">Custom</option>
          </select>
        </label>
        <label class="block">
          <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Theme</span>
          <input type="search" [value]="theme()" (input)="setTheme($event)" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Any theme" />
        </label>
        <div class="flex items-end">
          <button type="submit" class="w-full rounded-lg bg-slate-700 px-3 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500">Apply</button>
        </div>
      </form>

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
      } @else if (indexes().length === 0) {
        <div class="rounded-xl border border-slate-700/60 bg-slate-800/60 p-12 text-center">
          <p class="text-sm text-slate-500">No market indices found.</p>
        </div>
      } @else {
        <p class="text-xs text-slate-500">{{ indexes().length }} market index(es)</p>
        <div class="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-800/60">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-700/60">
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Theme</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Value</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Daily Return</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Constituents</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Snapshot</th>
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (index of indexes(); track index.id) {
                  <tr class="border-b border-slate-700/40">
                    <td class="px-4 py-3">
                      <a [routerLink]="['/market-indices', index.id]" class="font-semibold text-white hover:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500">{{ index.name }}</a>
                      @if (index.description) {
                        <p class="mt-0.5 max-w-sm truncate text-xs text-slate-500">{{ index.description }}</p>
                      }
                    </td>
                    <td class="px-4 py-3 text-slate-300">{{ index.theme || '-' }}</td>
                    <td class="px-4 py-3">
                      <span class="rounded-full border px-2.5 py-1 text-xs font-semibold" [class]="visibilityClass(index.visibility)">{{ visibilityLabel(index.visibility) }}</span>
                    </td>
                    <td class="px-4 py-3 text-right font-mono text-slate-200">{{ formatNumber(index.value) }}</td>
                    <td class="px-4 py-3 text-right font-mono" [class]="returnClass(index.dailyReturn)">{{ formatPercent(index.dailyReturn) }}</td>
                    <td class="px-4 py-3 text-right font-mono text-slate-300">{{ index.constituentCount }}</td>
                    <td class="px-4 py-3"><span class="rounded-full border px-2.5 py-1 text-xs font-semibold" [class]="statusClass(index.status)">{{ index.status }}</span></td>
                    <td class="px-4 py-3 text-slate-400">{{ formatDate(index.latestSnapshot?.date) }}</td>
                    <td class="px-4 py-3">
                      <div class="flex justify-end gap-2">
                        <a [routerLink]="['/market-indices', index.id]" class="rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500">Open</a>
                        <button type="button" (click)="refresh(index)" class="rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500">Refresh</button>
                        @if (canManage(index)) {
                          <button type="button" (click)="askDelete(index)" class="rounded-lg bg-red-600/20 px-2.5 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-600/30 focus:outline-none focus:ring-2 focus:ring-red-500">Delete</button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      @if (createOpen()) {
        <div class="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="create-index-title">
          <div class="absolute inset-0 bg-black/70" (click)="closeCreate()"></div>
          <div class="relative w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-2xl">
            <div class="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="create-index-title" class="text-lg font-semibold text-white">Create {{ createForm.controls.visibility.value === 'system' ? 'System' : 'Custom' }} Index</h2>
                <p class="mt-1 text-sm text-slate-500">Select 2 to 15 symbols and let the backend build the index.</p>
              </div>
              <button type="button" (click)="closeCreate()" class="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500" aria-label="Close create index dialog">x</button>
            </div>

            <form [formGroup]="createForm" (ngSubmit)="submitCreate()" class="space-y-4">
              <div class="grid gap-4 md:grid-cols-2">
                <label class="block">
                  <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Name</span>
                  <input formControlName="name" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label class="block">
                  <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Theme</span>
                  <input formControlName="theme" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
              </div>
              <label class="block">
                <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Description</span>
                <textarea formControlName="description" rows="2" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
              </label>
              <div class="grid gap-4 md:grid-cols-4">
                <label class="block">
                  <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Visibility</span>
                  <select formControlName="visibility" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="user">Custom</option>
                    @if (isAdmin()) {
                      <option value="system">System</option>
                    }
                  </select>
                </label>
                <label class="block">
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
                  <span class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Backfill Months</span>
                  <input type="number" min="1" max="6" formControlName="backfillMonths" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
              </div>

              <div>
                <label for="index-symbol-search" class="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Symbols</label>
                <div class="relative">
                  <input id="index-symbol-search" type="search" [value]="symbolQuery()" (input)="onSymbolSearch($event)" class="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search by company or ticker" role="combobox" autocomplete="off" aria-autocomplete="list" aria-controls="index-symbol-results" [attr.aria-expanded]="showSymbolResults()" />
                  @if (showSymbolResults()) {
                    <div id="index-symbol-results" class="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl" role="listbox">
                      @for (result of symbolResults(); track result.internalTicker || result.displayTicker || result.ticker || $index) {
                        <button type="button" (click)="addSymbol(result)" class="block w-full px-4 py-3 text-left hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" role="option">
                          <span class="block text-sm font-semibold text-white">{{ resultSymbol(result) }}</span>
                          <span class="block text-sm text-slate-300">{{ resultName(result) }}</span>
                        </button>
                      }
                    </div>
                  }
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  @for (symbol of symbols(); track symbol) {
                    <button type="button" (click)="removeSymbol(symbol)" class="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500" [attr.aria-label]="'Remove ' + symbol">{{ symbol }} <span aria-hidden="true">x</span></button>
                  }
                </div>
                @if (symbols().length < 2 && createSubmitted()) {
                  <p class="mt-2 text-sm text-red-300" role="alert">Add at least 2 symbols.</p>
                }
              </div>

              @if (createError()) {
                <p class="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300" role="alert">{{ createError() }}</p>
              }

              <div class="flex justify-end gap-3">
                <button type="button" (click)="closeCreate()" class="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500">Cancel</button>
                <button type="submit" [disabled]="createSaving()" class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500">Create</button>
              </div>
            </form>
          </div>
        </div>
      }

      <app-confirm-dialog
        [open]="deleteTarget() !== null"
        title="Delete market index"
        [message]="'Delete ' + (deleteTarget()?.name ?? 'this index') + '?'"
        warningText="This is a soft delete. The index will no longer appear in active lists."
        [danger]="true"
        confirmLabel="Delete"
        dialogId="delete-market-index"
        (confirmed)="deleteConfirmed()"
        (cancelled)="deleteTarget.set(null)"
      />
    </div>
  `,
})
export class MarketIndicesListPage implements OnInit, OnDestroy {
  private readonly api = inject(MarketIndicesApiService);
  private readonly analysisApi = inject(AnalysisApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly symbolTerms = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private pollHandle: ReturnType<typeof setTimeout> | null = null;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal('');
  readonly indexes = signal<IndexListItem[]>([]);
  readonly search = signal('');
  readonly theme = signal('');
  readonly visibility = signal<IndexVisibility | ''>('');
  readonly createOpen = signal(false);
  readonly createSaving = signal(false);
  readonly createError = signal('');
  readonly createSubmitted = signal(false);
  readonly symbols = signal<string[]>([]);
  readonly symbolQuery = signal('');
  readonly symbolResults = signal<AnalysisInstrumentSearchResult[]>([]);
  readonly symbolLoading = signal(false);
  readonly showSymbolResults = signal(false);
  readonly deleteTarget = signal<IndexListItem | null>(null);

  readonly isAdmin = computed(() => this.hasAdminCapability());

  readonly createForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    theme: [''],
    visibility: ['user' as IndexVisibility, [Validators.required]],
    weightingMethod: ['market_cap_capped' as WeightingMethod],
    maxWeightPercent: [DEFAULT_MAX_WEIGHT_PERCENT, [Validators.min(5), Validators.max(100)]],
    backfillMonths: [3, [Validators.min(1), Validators.max(6)]],
  });

  constructor() {
    this.symbolTerms.pipe(
      map(term => term.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      filter(term => {
        if (term.length >= 2) return true;
        this.symbolLoading.set(false);
        this.symbolResults.set([]);
        this.showSymbolResults.set(false);
        return false;
      }),
      switchMap(term => {
        this.symbolLoading.set(true);
        return this.analysisApi.searchInstruments(term).pipe(catchError(() => of([])));
      }),
      takeUntil(this.destroy$),
    ).subscribe(results => {
      this.symbolResults.set(results);
      this.showSymbolResults.set(results.length > 0);
      this.symbolLoading.set(false);
    });
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearPoll();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.listIndexes({
      search: this.search(),
      theme: this.theme(),
      visibility: this.visibility() || undefined,
    }).subscribe({
      next: indexes => {
        this.indexes.set(indexes);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.extractMessage(err, 'Failed to load market indices.'));
        this.loading.set(false);
      },
    });
  }

  applyFilters(event: Event): void {
    event.preventDefault();
    this.load();
  }

  setSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement | null)?.value ?? '');
  }

  setTheme(event: Event): void {
    this.theme.set((event.target as HTMLInputElement | null)?.value ?? '');
  }

  setVisibility(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value;
    this.visibility.set(value === 'system' || value === 'user' ? value : '');
  }

  openCreate(visibility: IndexVisibility): void {
    this.createForm.reset({
      name: '',
      description: '',
      theme: '',
      visibility: visibility === 'system' && !this.isAdmin() ? 'user' : visibility,
      weightingMethod: 'market_cap_capped',
      maxWeightPercent: DEFAULT_MAX_WEIGHT_PERCENT,
      backfillMonths: 3,
    });
    this.symbols.set([]);
    this.symbolQuery.set('');
    this.symbolResults.set([]);
    this.createError.set('');
    this.createSubmitted.set(false);
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
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

  submitCreate(): void {
    this.createSubmitted.set(true);
    if (this.createForm.invalid || this.symbols().length < 2) return;
    this.createSaving.set(true);
    this.createError.set('');
    this.api.createIndex(this.createPayload()).subscribe({
      next: response => {
        this.createSaving.set(false);
        this.createOpen.set(false);
        this.message.set(`Index creation started (${response.status}).`);
        this.load();
        this.pollIndex(response.id);
      },
      error: (err: HttpErrorResponse) => {
        this.createError.set(this.extractMessage(err, 'Failed to create market index.'));
        this.createSaving.set(false);
      },
    });
  }

  refresh(index: IndexListItem): void {
    this.error.set('');
    this.api.refreshIndex(index.id).subscribe({
      next: response => {
        this.message.set(`Refresh started for ${index.name} (${response.status}).`);
        this.pollIndex(index.id);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.extractMessage(err, 'Refresh failed. You may not have permission to refresh this index.'));
      },
    });
  }

  askDelete(index: IndexListItem): void {
    this.deleteTarget.set(index);
  }

  deleteConfirmed(): void {
    const target = this.deleteTarget();
    if (!target) return;
    this.api.deleteIndex(target.id).subscribe({
      next: () => {
        this.message.set(`${target.name} was deleted.`);
        this.deleteTarget.set(null);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.extractMessage(err, 'Delete failed. You may not have permission to delete this index.'));
        this.deleteTarget.set(null);
      },
    });
  }

  canManage(index: IndexListItem): boolean {
    return index.visibility === 'user' || this.isAdmin();
  }

  visibilityLabel(visibility: IndexVisibility): string {
    return visibility === 'system' ? 'System' : 'Custom';
  }

  resultSymbol(result: AnalysisInstrumentSearchResult): string {
    return (result.displayTicker?.trim() || result.ticker?.trim() || result.internalTicker?.trim() || '-').toUpperCase();
  }

  resultName(result: AnalysisInstrumentSearchResult): string {
    return result.name?.trim() || 'Unknown company';
  }

  formatNumber(value: number | null | undefined): string {
    if (value == null) return '-';
    return value.toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  }

  formatPercent(value: number | null | undefined): string {
    if (value == null) return '-';
    return `${(value * 100).toLocaleString('en-GB', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
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

  visibilityClass(visibility: IndexVisibility): string {
    return visibility === 'system'
      ? 'border-slate-400/30 bg-slate-400/10 text-slate-200'
      : 'border-blue-500/30 bg-blue-500/10 text-blue-300';
  }

  private pollIndex(id: string): void {
    this.clearPoll();
    const poll = () => {
      this.api.getIndex(id).subscribe({
        next: details => {
          if (details.status === 'READY' || details.status === 'PARTIAL' || details.status === 'FAILED') {
            this.message.set(`Index ${details.name} is ${details.status}.`);
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

  private createPayload(): CreateCustomIndexRequest {
    const value = this.createForm.getRawValue();
    return {
      name: value.name.trim(),
      description: value.description.trim() || undefined,
      theme: value.theme.trim() || undefined,
      visibility: value.visibility,
      symbols: this.symbols(),
      weightingMethod: value.weightingMethod,
      maxWeight: this.percentToRatio(value.maxWeightPercent),
      backfillMonths: value.backfillMonths,
    };
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
