import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar';
import { TopbarComponent } from '../topbar/topbar';

@Component({
  selector: 'app-dashboard-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <div class="flex h-screen overflow-hidden bg-slate-950">
      <app-sidebar />
      <div class="flex flex-col flex-1 min-w-0">
        <app-topbar />
        <main class="flex-1 overflow-auto p-6" id="main-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class DashboardShell {}
