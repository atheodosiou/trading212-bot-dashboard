import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Trading212ApiService } from '../../../core/api/trading212-api.service';
import { BadgeComponent } from '../../../shared/ui/badge/badge';
import type {
  CredentialEnvironment,
  MaskedCredentials,
  ValidationResult,
} from '../../../core/models/trading212.models';

type CredentialMode = 'view' | 'save' | 'update';

@Component({
  selector: 'app-t212-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  templateUrl: './t212-settings.html',
})
export class T212SettingsPage implements OnInit {
  private readonly api = inject(Trading212ApiService);

  // ─── Page state ───────────────────────────────────────────────────────────

  readonly credentials = signal<MaskedCredentials[]>([]);
  readonly loading = signal(true);
  readonly pageError = signal('');
  readonly successMsg = signal('');
  readonly operationError = signal('');

  // ─── Derived ──────────────────────────────────────────────────────────────

  readonly demoCredentials = computed(() =>
    this.credentials().find(c => c.environment === 'demo') ?? null,
  );
  readonly liveCredentials = computed(() =>
    this.credentials().find(c => c.environment === 'live') ?? null,
  );
  readonly activeCredentials = computed(() =>
    this.credentials().find(c => c.isActive) ?? null,
  );
  readonly activeEnvironment = computed(() =>
    this.activeCredentials()?.environment ?? null,
  );

  // ─── Form modes ───────────────────────────────────────────────────────────

  readonly demoMode = signal<CredentialMode>('view');
  readonly liveMode = signal<CredentialMode>('view');

  // ─── Form field values ────────────────────────────────────────────────────

  readonly demoApiKey = signal('');
  readonly demoApiSecret = signal('');
  readonly liveApiKey = signal('');
  readonly liveApiSecret = signal('');

  // ─── In-flight operation tracking ─────────────────────────────────────────

  readonly saving = signal<CredentialEnvironment | null>(null);
  readonly validating = signal<CredentialEnvironment | null>(null);
  readonly deleting = signal<CredentialEnvironment | null>(null);
  readonly activating = signal<CredentialEnvironment | null>(null);

  // ─── Confirmation dialogs ─────────────────────────────────────────────────

  readonly confirmActivate = signal<CredentialEnvironment | null>(null);
  readonly confirmDelete = signal<CredentialEnvironment | null>(null);
  readonly confirmSwitch = signal<CredentialEnvironment | null>(null);

  // ─── Busy check ───────────────────────────────────────────────────────────

  readonly anyBusy = computed(() =>
    this.saving() !== null ||
    this.validating() !== null ||
    this.deleting() !== null ||
    this.activating() !== null,
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.pageError.set('');
    this.api.getCredentials().subscribe({
      next: creds => {
        this.credentials.set(creds);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.pageError.set(this.extractMessage(err, 'Failed to load credentials.'));
        this.loading.set(false);
      },
    });
  }

  // ─── Form mode ────────────────────────────────────────────────────────────

  showSaveForm(env: CredentialEnvironment): void {
    this.clearMessages();
    if (env === 'demo') {
      this.demoApiKey.set('');
      this.demoApiSecret.set('');
      this.demoMode.set('save');
    } else {
      this.liveApiKey.set('');
      this.liveApiSecret.set('');
      this.liveMode.set('save');
    }
  }

  showUpdateForm(env: CredentialEnvironment): void {
    this.clearMessages();
    if (env === 'demo') {
      this.demoApiKey.set('');
      this.demoApiSecret.set('');
      this.demoMode.set('update');
    } else {
      this.liveApiKey.set('');
      this.liveApiSecret.set('');
      this.liveMode.set('update');
    }
  }

  cancelForm(env: CredentialEnvironment): void {
    if (env === 'demo') this.demoMode.set('view');
    else this.liveMode.set('view');
  }

  // ─── Save new credentials ─────────────────────────────────────────────────

  saveCredentials(env: CredentialEnvironment): void {
    const apiKey = env === 'demo' ? this.demoApiKey() : this.liveApiKey();
    const apiSecret = env === 'demo' ? this.demoApiSecret() : this.liveApiSecret();
    if (!apiKey.trim()) return;

    this.clearMessages();
    this.saving.set(env);
    this.api
      .createCredentials({
        environment: env,
        apiKey: apiKey.trim(),
        ...(apiSecret.trim() ? { apiSecret: apiSecret.trim() } : {}),
      })
      .subscribe({
        next: () => {
          this.saving.set(null);
          if (env === 'demo') this.demoMode.set('view');
          else this.liveMode.set('view');
          this.successMsg.set(`${env.toUpperCase()} credentials saved.`);
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(null);
          this.operationError.set(this.extractMessage(err, 'Failed to save credentials.'));
        },
      });
  }

  // ─── Update existing credentials ──────────────────────────────────────────

  updateCredentials(env: CredentialEnvironment): void {
    const apiKey = env === 'demo' ? this.demoApiKey() : this.liveApiKey();
    const apiSecret = env === 'demo' ? this.demoApiSecret() : this.liveApiSecret();
    if (!apiKey.trim()) return;

    this.clearMessages();
    this.saving.set(env);
    this.api
      .updateCredentials(env, {
        apiKey: apiKey.trim(),
        ...(apiSecret.trim() ? { apiSecret: apiSecret.trim() } : {}),
      })
      .subscribe({
        next: () => {
          this.saving.set(null);
          if (env === 'demo') this.demoMode.set('view');
          else this.liveMode.set('view');
          this.successMsg.set(`${env.toUpperCase()} credentials updated. Validation status reset.`);
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(null);
          this.operationError.set(this.extractMessage(err, 'Failed to update credentials.'));
        },
      });
  }

  // ─── Validate ─────────────────────────────────────────────────────────────

  validateCredentials(env: CredentialEnvironment): void {
    this.clearMessages();
    this.validating.set(env);
    this.api.validateCredentials(env).subscribe({
      next: (result: ValidationResult) => {
        this.validating.set(null);
        if (result.validationStatus === 'valid') {
          this.successMsg.set(`${env.toUpperCase()} credentials are valid.`);
        } else if (result.validationStatus === 'rate_limited') {
          this.operationError.set(
            `Trading212 rate-limited the validation request (HTTP 429). Your credentials were not changed — try again in a few minutes.`,
          );
        } else {
          this.operationError.set(
            `${env.toUpperCase()} credentials are invalid: ${result.error ?? 'Unknown error'}`,
          );
        }
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.validating.set(null);
        this.operationError.set(this.extractMessage(err, 'Validation failed.'));
      },
    });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  requestDelete(env: CredentialEnvironment): void {
    this.confirmDelete.set(env);
  }

  confirmDeleteCredentials(): void {
    const env = this.confirmDelete();
    if (!env) return;
    this.clearMessages();
    this.deleting.set(env);
    this.confirmDelete.set(null);
    this.api.deleteCredentials(env).subscribe({
      next: () => {
        this.deleting.set(null);
        this.successMsg.set(`${env.toUpperCase()} credentials deleted.`);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.set(null);
        this.operationError.set(this.extractMessage(err, 'Delete failed.'));
      },
    });
  }

  cancelDelete(): void {
    this.confirmDelete.set(null);
  }

  // ─── Activate (from credential card) ──────────────────────────────────────

  requestActivate(env: CredentialEnvironment): void {
    this.confirmActivate.set(env);
  }

  confirmActivateEnvironment(): void {
    const env = this.confirmActivate();
    if (!env) return;
    this.doActivate(env);
    this.confirmActivate.set(null);
  }

  cancelActivate(): void {
    this.confirmActivate.set(null);
  }

  // ─── Switch (from active account card) ────────────────────────────────────

  requestSwitch(env: CredentialEnvironment): void {
    this.confirmSwitch.set(env);
  }

  confirmSwitchEnvironment(): void {
    const env = this.confirmSwitch();
    if (!env) return;
    this.doActivate(env);
    this.confirmSwitch.set(null);
  }

  cancelSwitch(): void {
    this.confirmSwitch.set(null);
  }

  // ─── Shared activate logic ────────────────────────────────────────────────

  private doActivate(env: CredentialEnvironment): void {
    this.clearMessages();
    this.activating.set(env);
    this.api.activateCredentials(env).subscribe({
      next: () => {
        this.activating.set(null);
        this.successMsg.set(`Switched to ${env.toUpperCase()} environment.`);
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.activating.set(null);
        this.operationError.set(this.extractMessage(err, 'Activation failed.'));
      },
    });
  }

  // ─── Template helpers ──────────────────────────────────────────────────────

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

  formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  }

  isEnvBusy(env: CredentialEnvironment): boolean {
    return (
      this.saving() === env ||
      this.validating() === env ||
      this.deleting() === env ||
      this.activating() === env
    );
  }

  private clearMessages(): void {
    this.successMsg.set('');
    this.operationError.set('');
  }

  private extractMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string | string[] } | null;
    if (!body) return fallback;
    const msg = body.message;
    if (Array.isArray(msg)) return msg.join(' ');
    return msg ?? fallback;
  }
}
