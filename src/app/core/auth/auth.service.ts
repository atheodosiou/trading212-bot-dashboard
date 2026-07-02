import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { AdminApiService } from '../api/admin-api.service';
import { TokenStorageService } from './token-storage.service';
import type { User } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AdminApiService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(this.tokenStorage.getToken());
  private readonly _user = signal<User | null>(this.loadUser());

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());

  private loadUser(): User | null {
    const raw = this.tokenStorage.getRawUser();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  /**
   * Exchanges a Google ID token (from GIS credential callback) for a backend JWT.
   * The backend verifies the Google token and issues its own accessToken.
   */
  loginWithGoogle(idToken: string) {
    return this.api.postGoogleAuth(idToken).pipe(
      tap(res => {
        this._token.set(res.accessToken);
        this._user.set(res.user);
        this.tokenStorage.setToken(res.accessToken);
        this.tokenStorage.setRawUser(JSON.stringify(res.user));
      }),
    );
  }

  /** Dev-only mock login — only reachable when environment.enableMockLogin is true. */
  mockLogin(): void {
    const mockUser: User = { email: 'admin@tradingbot.dev', name: 'Admin User', isAdmin: true, roles: ['admin'] };
    const mockToken = 'mock-jwt-token';
    this._token.set(mockToken);
    this._user.set(mockUser);
    this.tokenStorage.setToken(mockToken);
    this.tokenStorage.setRawUser(JSON.stringify(mockUser));
  }

  logout(): void {
    this._token.set(null);
    this._user.set(null);
    this.tokenStorage.clearAll();
    this.router.navigate(['/login']);
  }
}
