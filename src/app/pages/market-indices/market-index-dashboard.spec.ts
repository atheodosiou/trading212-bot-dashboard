import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AnalysisApiService } from '../../core/api/analysis-api.service';
import { MarketIndicesApiService } from '../../core/api/market-indices-api.service';
import type { IndexDashboard, IndexDetails } from '../../core/api/models/market-indices-api.model';
import { AuthService } from '../../core/auth/auth.service';
import { MarketIndexDashboardPage } from './market-index-dashboard';

describe('MarketIndexDashboardPage', () => {
  let fixture: ComponentFixture<MarketIndexDashboardPage>;
  let component: MarketIndexDashboardPage;
  let api: {
    getDashboard: ReturnType<typeof vi.fn>;
    getIndex: ReturnType<typeof vi.fn>;
    refreshIndex: ReturnType<typeof vi.fn>;
    rebalanceIndex: ReturnType<typeof vi.fn>;
    deleteIndex: ReturnType<typeof vi.fn>;
  };

  const dashboard: IndexDashboard = {
    latestValue: 1010,
    dailyReturn: 0.015,
    history: [
      { date: '2026-06-24', value: 990, dailyReturn: 0 },
      { date: '2026-06-25', value: 1010, dailyReturn: 0.015 },
    ],
    constituents: [
      {
        symbol: 'AAPL',
        companyName: 'Apple',
        sector: 'Technology',
        industry: 'Consumer Electronics',
        marketCap: 3000000000000,
        rawWeight: 0.6,
        weight: 0.5,
        dataSource: 'massive',
        dailyReturn: -0.0553,
        contribution: -0.0138,
      },
      {
        symbol: 'MSFT',
        companyName: 'Microsoft',
        sector: 'Technology',
        industry: 'Software',
        marketCap: 2800000000000,
        rawWeight: 0.4,
        weight: 0.5,
        dataSource: 'cache',
        dailyReturn: -0.01,
        contribution: -0.005,
      },
    ],
    topContributors: [{ symbol: 'MSFT', contribution: 0.01 }],
    topDetractors: [{ symbol: 'AAPL', contribution: -0.0138 }],
    summary: {
      bestPerformer: 'AAPL',
      worstPerformer: 'MSFT',
      largestWeight: 'AAPL',
      constituents: 2,
    },
    health: {
      priceCoverage: 0.8889,
      profileCoverage: 0.5,
      lastRefresh: '2026-06-25T12:00:00Z',
      status: 'READY',
    },
    dataQuality: {
      missingProfiles: ['MSFT'],
      missingPrices: [],
      usedCachedData: false,
      providerCallsUsed: 2,
      providerCallsRemaining: 10,
      providerRateLimit: { callsPerMinute: 5, minIntervalMs: 13000 },
    },
  };

  const details: IndexDetails = {
    id: 'idx-1',
    name: 'Quality Compounders',
    description: 'Durable earnings',
    theme: 'Quality',
    visibility: 'user',
    weightingMethod: 'market_cap_capped',
    maxWeight: 0.4,
    status: 'READY',
    statusMessage: null,
    value: 1010,
    dailyReturn: 0.015,
    historyStatus: 'complete',
    constituents: dashboard.constituents,
    dataQuality: dashboard.dataQuality,
  };

  beforeEach(async () => {
    api = {
      getDashboard: vi.fn(() => of(dashboard)),
      getIndex: vi.fn(() => of(details)),
      refreshIndex: vi.fn(() => of({ id: 'idx-1', status: 'BUILDING' })),
      rebalanceIndex: vi.fn(() => of({ id: 'idx-1', status: 'REBALANCING' })),
      deleteIndex: vi.fn(() => of({ deleted: true })),
    };

    await TestBed.configureTestingModule({
      imports: [MarketIndexDashboardPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'idx-1' }) } } },
        { provide: MarketIndicesApiService, useValue: api },
        { provide: AnalysisApiService, useValue: { searchInstruments: vi.fn(() => of([])) } },
        { provide: AuthService, useValue: { user: signal({ email: 'user@example.com', name: 'User' }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketIndexDashboardPage);
    component = fixture.componentInstance;
  });

  it('renders dashboard data, contributors, detractors, health, and constituents', () => {
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(api.getDashboard).toHaveBeenCalledWith('idx-1');
    expect(text).toContain('Quality Compounders');
    expect(text).toContain('1.50%');
    expect(text).toContain('-5.53%');
    expect(text).toContain('-1.38%');
    expect(text).toContain('88.89%');
    expect(text).not.toContain('8,889.00%');
    expect(text).not.toContain('-553.00%');
    expect(text).not.toContain('-138.00%');
    expect(text).not.toContain('fmp');
    expect(text).toContain('Massive');
    expect(text).toContain('Cache');
    expect(text).toContain('Used Cached Data');
    expect(text).toContain('Yes');
    expect(text).toContain('Provider Calls');
    expect(text).toContain('2 / 10');
    expect(text).toContain('Top Contributors');
    expect(text).toContain('AAPL');
    expect(text).toContain('Top Detractors');
    expect(text).toContain('MSFT');
  });

  it('polls dashboard after refresh until terminal status', () => {
    vi.useFakeTimers();
    const building = { ...dashboard, health: { ...dashboard.health, status: 'BUILDING' as const } };
    api.getDashboard
      .mockReturnValueOnce(of(dashboard))
      .mockReturnValueOnce(of(building))
      .mockReturnValueOnce(of(dashboard));
    fixture.detectChanges();

    component.refresh();
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(5000);

    expect(api.refreshIndex).toHaveBeenCalledWith('idx-1');
    expect(component.message()).toContain('READY');
    vi.useRealTimers();
  });

  it('submits rebalance with symbols and handles validation', () => {
    fixture.detectChanges();
    component.openRebalance();
    expect(component.rebalanceForm.controls.maxWeightPercent.value).toBe(40);
    component.removeSymbol('AAPL');
    component.submitRebalance();
    expect(api.rebalanceIndex).not.toHaveBeenCalled();
    expect(component.rebalanceError()).toContain('at least 2 symbols');

    component.addSymbol({ displayTicker: 'NVDA', name: 'Nvidia' });
    component.submitRebalance();
    expect(api.rebalanceIndex).toHaveBeenCalledWith('idx-1', expect.objectContaining({
      symbols: ['MSFT', 'NVDA'],
      maxWeight: 0.4,
      reason: 'manual_rebalance',
    }));
  });

  it('defaults rebalance max weight to 25 percent when index max weight is unavailable', () => {
    fixture.detectChanges();
    component.details.set({ ...details, maxWeight: null });
    component.openRebalance();

    expect(component.rebalanceForm.controls.maxWeightPercent.value).toBe(25);
  });

  it('shows backend errors for forbidden actions and navigates after delete', () => {
    fixture.detectChanges();
    api.refreshIndex.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } })));
    component.refresh();
    expect(component.error()).toContain('Forbidden');

    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate');
    component.deleteConfirmed();
    expect(api.deleteIndex).toHaveBeenCalledWith('idx-1');
    expect(navigate).toHaveBeenCalledWith(['/market-indices']);
  });
});
