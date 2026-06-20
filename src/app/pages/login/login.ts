import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { GoogleAuthService } from '../../core/auth/google-auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
})
export class LoginPage implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly gis    = inject(GoogleAuthService);
  private readonly router = inject(Router);
  private readonly zone   = inject(NgZone);

  readonly loading      = signal(false);
  readonly error        = signal('');
  /** True once the GIS script has loaded and initialize() has been called. */
  readonly gisReady     = signal(false);
  /** Exposed to the template so @if can gate the mock-login link. */
  readonly showMockLogin = environment.enableMockLogin;

  ngOnInit(): void {
    // Redirect already-authenticated users straight to the dashboard.
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/trading212/dashboard']);
      return;
    }

    // Load GIS asynchronously — no blocking UI effect while it loads.
    this.gis
      .loadScript()
      .then(() => {
        this.gis.initialize(environment.googleClientId, (idToken) => {
          // GIS callback fires outside Angular's zone — run back inside it.
          this.zone.run(() => this.handleIdToken(idToken));
        });
        // Mark ready inside the zone so OnPush picks it up.
        this.zone.run(() => this.gisReady.set(true));
      })
      .catch(() => {
        this.zone.run(() =>
          this.error.set(
            'Could not load Google Sign-In. Check your network and refresh the page.',
          ),
        );
      });
  }

  signInWithGoogle(): void {
    if (!this.gisReady()) {
      this.error.set('Google Sign-In is still loading — please wait a moment.');
      return;
    }
    this.loading.set(true);
    this.error.set('');

    this.gis.prompt(() => {
      // GIS could not display the prompt (e.g. user dismissed One Tap previously,
      // FedCM browser policy, or no Google account signed in).
      this.zone.run(() => {
        this.loading.set(false);
        this.error.set(
          'Google Sign-In could not be shown. Try signing in to Google in your browser first, or check that pop-ups are not blocked.',
        );
      });
    });
  }

  /** Dev-only — only rendered when environment.enableMockLogin is true. */
  mockLogin(): void {
    this.auth.mockLogin();
    this.router.navigate(['/trading212/dashboard']);
  }

  private handleIdToken(idToken: string): void {
    this.loading.set(true);
    this.error.set('');

    this.auth.loginWithGoogle(idToken).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/trading212/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.gis.disableAutoSelect();
        this.loading.set(false);
        this.error.set(this.extractMessage(err, 'Authentication failed. Please try again.'));
      },
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
