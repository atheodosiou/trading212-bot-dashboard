import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.LoginPage),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/dashboard-shell/dashboard-shell').then(m => m.DashboardShell),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'trading212/dashboard', pathMatch: 'full' },
      {
        path: 'trading212/dashboard',
        loadComponent: () =>
          import('./pages/trading212/dashboard/t212-dashboard').then(m => m.T212DashboardPage),
      },
      {
        path: 'trading212/orders',
        loadComponent: () =>
          import('./pages/trading212/orders/t212-orders').then(m => m.T212OrdersPage),
      },
      {
        path: 'trading212/dividends',
        loadComponent: () =>
          import('./pages/trading212/dividends/t212-dividends').then(m => m.T212DividendsPage),
      },
      {
        path: 'trading212/cash-transactions',
        loadComponent: () =>
          import('./pages/trading212/cash-transactions/t212-cash-transactions').then(
            m => m.T212CashTransactionsPage,
          ),
      },
      {
        path: 'trading212/positions',
        loadComponent: () =>
          import('./pages/trading212/positions/t212-positions').then(m => m.T212PositionsPage),
      },
      {
        path: 'trading212/valuation-center',
        loadComponent: () =>
          import('./pages/valuation-center/valuation-center').then(m => m.ValuationCenterPage),
      },
      {
        path: 'trading212/tax-summary',
        loadComponent: () =>
          import('./pages/trading212/tax-summary/t212-tax-summary').then(
            m => m.T212TaxSummaryPage,
          ),
      },
      {
        path: 'trading212/tax-center',
        loadComponent: () =>
          import('./pages/trading212/tax-center/t212-tax-center').then(
            m => m.T212TaxCenterPage,
          ),
      },
      {
        path: 'trading212/reports',
        loadComponent: () =>
          import('./pages/trading212/reports/t212-reports').then(m => m.T212ReportsPage),
      },
      {
        path: 'trading212/settings',
        loadComponent: () =>
          import('./pages/trading212/settings/t212-settings').then(m => m.T212SettingsPage),
      },
    ],
  },
  { path: '**', redirectTo: '/trading212/dashboard' },
];
