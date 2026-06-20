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
import type {
  ConnectionStatus,
  ConnectionStatusKind,
  MaskedCredentials,
  SyncLogEntry,
  SyncResult,
  SyncStatus,
  YearlySummary,
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
  readonly exporting = signal(false);
  readonly error = signal('');
  readonly syncResult = signal<SyncResult | null>(null);
  readonly connection = signal<ConnectionStatus | null>(null);
  readonly summary = signal<YearlySummary | null>(null);
  readonly credentials = signal<MaskedCredentials[]>([]);

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

  // Derived sync status kind — drives badge and label
  readonly syncStatusKind = computed((): 'running' | 'success' | 'failed' | 'never' => {
    const s = this.syncStatus();
    if (!s) return 'never';
    if (s.isRunning) return 'running';
    const hasSuccess = s.lastSuccessfulSync != null;
    const hasFailed = s.lastFailedSync != null;
    if (!hasSuccess && !hasFailed) return 'never';
    if (hasSuccess && !hasFailed) return 'success';
    if (!hasSuccess) return 'failed';
    return new Date(s.lastFailedSync!).getTime() > new Date(s.lastSuccessfulSync!).getTime()
      ? 'failed'
      : 'success';
  });

  readonly syncStatusBadgeVariant = computed((): 'running' | 'error' | 'demo' => {
    const kind = this.syncStatusKind();
    if (kind === 'running' || kind === 'success') return 'running';
    if (kind === 'failed') return 'error';
    return 'demo';
  });

  readonly syncStatusLabel = computed(() => {
    const kind = this.syncStatusKind();
    if (kind === 'running') return 'Running';
    if (kind === 'success') return 'Up to date';
    if (kind === 'failed') return 'Failed';
    return 'Never synced';
  });

  readonly quickLinks = [
    { path: '/trading212/orders',            label: 'Orders',            icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { path: '/trading212/dividends',         label: 'Dividends',         icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { path: '/trading212/cash-transactions', label: 'Cash Transactions',  icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { path: '/trading212/positions',         label: 'Open Positions',     icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { path: '/trading212/tax-summary',       label: 'Tax Summary',        icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { path: '/trading212/reports',           label: 'Export Report',      icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' },
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
      summary: this.api.getYearlySummary(this.selectedYear()),
      credentials: this.api.getCredentials(),
    }).subscribe({
      next: ({ connection, summary, credentials }) => {
        this.connection.set(connection);
        this.summary.set(summary);
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

  exportReport(): void {
    this.exporting.set(true);
    this.api.exportReport({ year: this.selectedYear(), format: 'xlsx' }).subscribe({
      next: blob => {
        this.downloadBlob(blob, `trading212-tax-report-${this.selectedYear()}.xlsx`);
        this.exporting.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.extractMessage(err, 'Export failed.'));
        this.exporting.set(false);
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
    return this.syncing() || (this.syncStatus()?.isRunning ?? false) || !this.credentialsReady();
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

  syncHistoryBadgeVariant(status: string): 'running' | 'error' | 'demo' {
    if (status === 'SUCCESS') return 'running';
    if (status === 'FAILED') return 'error';
    return 'demo';
  }

  formatCurrency(val: number | null | undefined): string {
    if (val == null) return '—';
    return val.toLocaleString('en-GB', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
  }

  formatDuration(ms: number | null | undefined): string {
    if (ms == null) return '—';
    return `${(ms / 1000).toFixed(1)}s`;
  }

  formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
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
