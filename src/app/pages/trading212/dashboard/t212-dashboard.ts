import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription, forkJoin, interval, switchMap, takeWhile } from 'rxjs';
import { Trading212ApiService } from '../../../core/api/trading212-api.service';
import { BadgeComponent } from '../../../shared/ui/badge/badge';
import { CardComponent } from '../../../shared/ui/card/card';
import type { BadgeVariant } from '../../../shared/ui/badge/badge';
import type {
  ConnectionStatus,
  ConnectionStatusKind,
  MaskedCredentials,
  SyncLogEntry,
  SyncResult,
  SyncStatus,
  TaxCenterResponse,
  TaxCenterYear,
} from '../../../core/models/trading212.models';

@Component({
  selector: 'app-t212-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, CardComponent, RouterLink],
  templateUrl: './t212-dashboard.html',
})
export class T212DashboardPage implements OnInit, OnDestroy {
  private readonly api = inject(Trading212ApiService);
  private pollSub: Subscription | null = null;

  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  readonly selectedYear = signal(new Date().getFullYear());

  // Main dashboard state
  readonly loading = signal(true);
  readonly syncing = signal(false);
  readonly error = signal('');
  readonly syncResult = signal<SyncResult | null>(null);
  readonly connection = signal<ConnectionStatus | null>(null);
  readonly taxCenter = signal<TaxCenterResponse | null>(null);
  readonly credentials = signal<MaskedCredentials[]>([]);

  readonly selectedYearSummary = computed((): TaxCenterYear => {
    const year = this.selectedYear();
    const row = this.taxCenter()?.years.find(item => item.year === year);
    return row ?? {
      year,
      realizedPnlEur: 0,
      costBasisEur: 0,
      proceedsEur: 0,
      dividendsEur: 0,
      depositsEur: 0,
      withdrawalsEur: 0,
      feesEur: 0,
      ordersCount: 0,
      reportsCount: 0,
      latestReportDate: null,
      hasWarnings: false,
    };
  });

  // Credentials derived state
  readonly activeCredentials = computed(() =>
    this.credentials().find(c => c.isActive) ?? null,
  );
  // Sync only requires active credentials to exist — the backend handles auth errors.
  // We don't block on validationStatus because 'unknown' credentials are still usable.
  readonly credentialsReady = computed(() => this.activeCredentials() !== null);

  // Sync status state
  readonly syncStatus = signal<SyncStatus | null>(null);
  readonly syncStatusLoading = signal(false);
  readonly syncStatusError = signal('');

  // Sync history state
  readonly syncHistory = signal<SyncLogEntry[]>([]);
  readonly syncHistoryLoading = signal(false);
  readonly syncHistoryError = signal('');

  // Readable labels for backend stream identifiers.
  private readonly streamLabels: Record<string, string> = {
    orders: 'Orders',
    cashTransactions: 'Cash Movements',
    dividends: 'Dividends',
  };

  private streamLabel(stream: string): string {
    return this.streamLabels[stream] ?? stream;
  }

  readonly catchingUpStreamLabels = computed((): string[] =>
    (this.syncStatus()?.catchingUpStreams ?? []).map(s => this.streamLabel(s)),
  );

  // Badge/label/helper text are driven directly by the backend's authoritative `status` field.
  readonly syncStatusBadgeVariant = computed((): BadgeVariant => {
    switch (this.syncStatus()?.status) {
      case 'RUNNING': return 'demo';
      case 'CATCHING_UP': return 'warning';
      case 'RATE_LIMITED': return 'critical';
      case 'FAILED': return 'error';
      case 'UP_TO_DATE': return 'healthy';
      default: return 'demo';
    }
  });

  readonly syncStatusLabel = computed((): string => {
    switch (this.syncStatus()?.status) {
      case 'RUNNING': return 'Syncing';
      case 'CATCHING_UP': return 'Catching up';
      case 'RATE_LIMITED': return 'Rate limited';
      case 'FAILED': return 'Failed';
      case 'UP_TO_DATE': return 'Up to date';
      default: return 'Never synced';
    }
  });

  readonly syncStatusHelperText = computed((): string => {
    switch (this.syncStatus()?.status) {
      case 'RUNNING': return 'Sync is currently running.';
      case 'CATCHING_UP': return 'More Trading212 history may be available. Run sync again to continue.';
      case 'RATE_LIMITED': return 'Trading212 rate limit is active. Try again after the reset time.';
      case 'FAILED': return 'Last sync failed. Check sync history/logs.';
      case 'UP_TO_DATE': return 'All enabled sync streams completed.';
      default: return '';
    }
  });

  readonly quickLinks = [
    { path: '/trading212/orders',            label: 'Orders',            icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { path: '/trading212/dividends',         label: 'Dividends',         icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { path: '/trading212/cash-transactions', label: 'Account Cash Movements', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { path: '/trading212/positions',         label: 'Open Positions',     icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { path: '/trading212/tax-summary',       label: 'Tax Summary',        icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { path: '/trading212/reports',           label: 'Report History',     icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
  ];

  ngOnInit(): void {
    this.load();
    this.loadSyncStatus();
    this.loadSyncHistory();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  // ─── Main dashboard ──────────────────────────────────────────────────────────

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      connection: this.api.getConnectionStatus(),
      taxCenter: this.api.getTaxCenter(),
      credentials: this.api.getCredentials(),
    }).subscribe({
      next: ({ connection, taxCenter, credentials }) => {
        this.connection.set(connection);
        this.taxCenter.set(taxCenter);
        this.credentials.set(credentials);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.extractMessage(err, 'Failed to load dashboard data.'));
        this.loading.set(false);
      },
    });
  }

  onYearChange(event: Event): void {
    this.selectedYear.set(Number((event.target as HTMLSelectElement).value));
    this.load();
  }

  triggerSync(fullResync = false): void {
    this.syncing.set(true);
    this.syncResult.set(null);
    this.api.triggerManualSync({ fullResync }).subscribe({
      next: result => {
        this.syncResult.set(result);
        this.syncing.set(false);
        this.load();
        this.loadSyncStatus();
        this.loadSyncHistory();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.extractMessage(err, 'Sync failed.'));
        this.syncing.set(false);
        this.loadSyncStatus();
      },
    });
  }

  // ─── Sync status ─────────────────────────────────────────────────────────────

  loadSyncStatus(): void {
    this.syncStatusLoading.set(true);
    this.syncStatusError.set('');
    this.api.getSyncStatus().subscribe({
      next: status => {
        this.syncStatus.set(status);
        this.syncStatusLoading.set(false);
        if (status.isRunning) {
          this.startPolling();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.syncStatusError.set(this.extractMessage(err, 'Could not load sync status.'));
        this.syncStatusLoading.set(false);
      },
    });
  }

  loadSyncHistory(): void {
    this.syncHistoryLoading.set(true);
    this.syncHistoryError.set('');
    this.api.getSyncHistory().subscribe({
      next: history => {
        this.syncHistory.set(history);
        this.syncHistoryLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.syncHistoryError.set(this.extractMessage(err, 'Could not load sync history.'));
        this.syncHistoryLoading.set(false);
      },
    });
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollSub = interval(5000).pipe(
      switchMap(() => this.api.getSyncStatus()),
      takeWhile(status => status.isRunning, true),
    ).subscribe(status => {
      this.syncStatus.set(status);
      if (!status.isRunning) {
        this.loadSyncHistory();
        this.load();
      }
    });
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  // ─── Template helpers ─────────────────────────────────────────────────────────

  isSyncDisabled(): boolean {
    const status = this.syncStatus();
    return this.syncing()
      || (status?.isRunning ?? false)
      || (status?.rateLimit?.isLimited ?? false)
      || !this.credentialsReady();
  }

  syncButtonLabel(): string {
    if (this.syncing() || this.syncStatus()?.isRunning) return 'Syncing...';
    if (this.syncStatus()?.status === 'CATCHING_UP') return 'Continue Sync';
    return 'Sync Trading212';
  }

  validationBadgeVariant(status: string): 'running' | 'error' | 'demo' {
    if (status === 'valid') return 'running';
    if (status === 'invalid') return 'error';
    return 'demo';
  }

  validationLabel(status: string): string {
    if (status === 'valid') return 'Valid';
    if (status === 'invalid') return 'Invalid';
    return 'Not validated';
  }

  connectionBadge(): 'running' | 'error' | 'demo' {
    const s = this.connection()?.status;
    if (s === 'connected') return 'running';
    if (s === 'disconnected') return 'error';
    return 'demo'; // rate_limited, not_validated
  }

  connectionLabel(): string {
    const s = this.connection()?.status as ConnectionStatusKind | undefined;
    if (s === 'connected') return 'Connected';
    if (s === 'rate_limited') return 'Rate Limited';
    if (s === 'not_validated') return 'Not Validated';
    return 'Disconnected';
  }

  syncHistoryBadgeVariant(status: string): BadgeVariant {
    if (status === 'SUCCESS') return 'running';
    if (status === 'FAILED') return 'error';
    if (status === 'RATE_LIMITED') return 'warning';
    return 'demo';
  }

  syncModeLabel(mode: SyncLogEntry['mode']): string {
    switch (mode) {
      case 'bootstrap': return 'Bootstrap';
      case 'incremental': return 'Incremental';
      case 'catchup': return 'Catch-up';
      case 'reconcile': return 'Reconcile';
      case 'full_rebuild': return 'Full rebuild';
      default: return 'Legacy';
    }
  }

  syncModeBadgeVariant(mode: SyncLogEntry['mode']): BadgeVariant {
    return mode === 'reconcile' ? 'critical' : 'default';
  }

  reconcileSummary(entry: SyncLogEntry): { inserted: number; changed: number; unchanged: number } | null {
    const stats = entry.reconcileStats;
    if (!stats) return null;

    const streams = [stats.orders, stats.dividends, stats.cashTransactions];
    let inserted = 0;
    let changed = 0;
    let unchanged = 0;
    for (const s of streams) {
      inserted += s?.inserted ?? 0;
      changed += s?.changed ?? 0;
      unchanged += s?.unchanged ?? 0;
    }

    return { inserted, changed, unchanged };
  }

  syncResultMessage(result: SyncResult): string {
    if (result.status === 'rate_limited') {
      if (result.resetAt) {
        return `Trading212 rate limit reached. Try again after ${this.formatDateTime(result.resetAt)}.`;
      }

      return 'Trading212 rate limit reached. Please try again later.';
    }

    if (result.status === 'failed') {
      return result.message || 'Trading212 sync failed.';
    }

    const orders = result.result.orders.synced;
    const dividends = result.result.dividends.synced;
    const cashMovements = result.result.cashTransactions.synced;
    const pageLimitStreams = result.result.pageLimitHitStreams ?? [];

    if (pageLimitStreams.length > 0) {
      const streamLabels = pageLimitStreams.map(s => this.streamLabel(s)).join(', ');
      return `Sync completed — ${orders} new ${this.pluralize('order', orders)}, ${dividends} new ${this.pluralize('dividend', dividends)}, ${cashMovements} new ${this.pluralize('cash movement', cashMovements)}. More history may be available for ${streamLabels}.`;
    }

    return 'Sync complete — account history is up to date.';
  }

  skippedDuplicatesMessage(result: SyncResult): string {
    if (result.status !== 'success') return '';

    const skipped = [
      this.skippedPart(result.result.orders.skipped, 'order'),
      this.skippedPart(result.result.dividends.skipped, 'dividend'),
      this.skippedPart(result.result.cashTransactions.skipped, 'cash movement'),
    ].filter((part): part is string => part !== null);

    return skipped.length ? `Skipped duplicates: ${skipped.join(', ')}.` : '';
  }

  syncResultAlertClass(result: SyncResult): string {
    if (result.status === 'success') {
      const pageLimitStreams = result.result.pageLimitHitStreams ?? [];
      return pageLimitStreams.length > 0
        ? 'p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-200 text-sm'
        : 'p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm';
    }

    if (result.status === 'rate_limited') {
      return 'p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-200 text-sm';
    }

    return 'p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm';
  }

  rateLimitRetryMessage(status: SyncStatus): string {
    if (!status.rateLimit?.isLimited) return '';
    if (status.rateLimit.resetAt) {
      return `Sync is rate limited until ${this.formatDateTime(status.rateLimit.resetAt)}.`;
    }

    if (status.rateLimit.retryAfterSeconds != null) {
      return `Sync is rate limited. Try again in ${this.formatSeconds(status.rateLimit.retryAfterSeconds)}.`;
    }

    return 'Sync is rate limited. Please try again later.';
  }

  rateLimitQuotaMessage(status: SyncStatus): string {
    const rateLimit = status.rateLimit;
    if (!rateLimit || rateLimit.remaining == null || rateLimit.limit == null) return '';
    return `${rateLimit.remaining.toLocaleString('en-GB')} of ${rateLimit.limit.toLocaleString('en-GB')} requests remaining.`;
  }

  formatCurrency(val: number | null | undefined): string {
    if (val == null) return '—';
    return val.toLocaleString('en-GB', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDuration(ms: number | null | undefined): string {
    if (ms == null) return '—';
    return `${(ms / 1000).toFixed(1)}s`;
  }

  formatSeconds(seconds: number): string {
    if (seconds < 60) return `${seconds} ${this.pluralize('second', seconds)}`;

    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) return `${minutes} ${this.pluralize('minute', minutes)}`;

    const hours = Math.ceil(minutes / 60);
    return `${hours} ${this.pluralize('hour', hours)}`;
  }

  formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  }

  private extractMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string | string[] } | null;
    if (!body) return fallback;
    const msg = body.message;
    if (Array.isArray(msg)) return msg.join(' ');
    return msg ?? fallback;
  }

  private skippedPart(count: number | null | undefined, label: string): string | null {
    if (!count) return null;
    return `${count} ${this.pluralize(label, count)}`;
  }

  private pluralize(label: string, count: number): string {
    return count === 1 ? label : `${label}s`;
  }
}
