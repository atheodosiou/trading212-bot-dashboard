import { Injectable } from '@angular/core';

// ─── Minimal GIS type declarations ───────────────────────────────────────────
// https://developers.google.com/identity/gsi/web/reference/js-reference

interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
  client_id: string;
}

interface PromptMomentNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
  getNotDisplayedReason(): string;
  getSkippedReason(): string;
  getDismissedReason(): string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    ux_mode?: 'popup' | 'redirect';
    nonce?: string;
  }): void;
  prompt(momentListener?: (notification: PromptMomentNotification) => void): void;
  renderButton(element: HTMLElement, config: Record<string, unknown>): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/**
 * Handles all interaction with Google Identity Services.
 * Components never access window.google directly — they go through this service.
 */
@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private loadPromise: Promise<void> | null = null;

  /**
   * Loads the GIS script once and returns a promise that resolves when ready.
   * Safe to call multiple times — subsequent calls return the same promise.
   */
  loadScript(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        this.loadPromise = null; // allow retry
        reject(new Error('Failed to load Google Identity Services script.'));
      };
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  /**
   * Initialises GIS with a client ID and a credential callback.
   * Must be called after loadScript() resolves.
   * The callback fires with the raw Google ID token (JWT) when the user signs in.
   */
  initialize(clientId: string, onCredential: (idToken: string) => void): void {
    window.google?.accounts.id.initialize({
      client_id: clientId,
      callback: (response: GoogleCredentialResponse) => onCredential(response.credential),
      auto_select: false,
      cancel_on_tap_outside: true,
      ux_mode: 'popup',
    });
  }

  /**
   * Triggers the One Tap / popup sign-in flow.
   * Calls onNotDisplayed if GIS cannot show the prompt
   * (e.g. user has dismissed One Tap recently, or FedCM policy blocks it).
   */
  prompt(onNotDisplayed?: () => void): void {
    window.google?.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        onNotDisplayed?.();
      }
    });
  }

  /**
   * Prevents future auto-sign-in for the current user.
   * Call after logout or on authentication errors so the user is prompted again on next visit.
   */
  disableAutoSelect(): void {
    window.google?.accounts.id.disableAutoSelect();
  }
}
