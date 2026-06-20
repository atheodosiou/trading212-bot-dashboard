import { Injectable } from '@angular/core';

const TOKEN_KEY = 'access_token';
const USER_KEY = 'user';

/**
 * Abstraction over token/user persistence.
 * Wraps localStorage so it can be swapped (e.g. sessionStorage, encrypted storage)
 * without touching AuthService or the interceptor.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  getRawUser(): string | null {
    return localStorage.getItem(USER_KEY);
  }

  setRawUser(json: string): void {
    localStorage.setItem(USER_KEY, json);
  }

  clearAll(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
