import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <header class="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
      <!-- Left: breadcrumb placeholder -->
      <div class="flex items-center gap-2">
        <span class="text-slate-500 text-sm">Trading212 Accounting</span>
      </div>

      <!-- Right: user + logout -->
      <div class="flex items-center gap-4">
        @if (user()) {
          <div class="flex items-center gap-3">
            <div class="text-right hidden sm:block">
              <p class="text-slate-200 text-xs font-medium leading-none">{{ user()!.name }}</p>
              <p class="text-slate-500 text-xs mt-0.5">{{ user()!.email }}</p>
            </div>
            <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0" aria-hidden="true">
              {{ initials() }}
            </div>
          </div>
        }
        <button
          type="button"
          (click)="logout()"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
          aria-label="Sign out"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Sign out
        </button>
      </div>
    </header>
  `,
})
export class TopbarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;

  readonly initials = () => {
    const u = this.user();
    if (!u) return '';
    return u.name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  logout(): void {
    this.auth.logout();
  }
}
