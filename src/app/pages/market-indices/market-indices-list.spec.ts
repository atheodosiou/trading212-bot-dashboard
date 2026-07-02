import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AnalysisApiService } from '../../core/api/analysis-api.service';
import { MarketIndicesApiService } from '../../core/api/market-indices-api.service';
import type { IndexDetails, IndexListItem } from '../../core/api/models/market-indices-api.model';
import { AuthService } from '../../core/auth/auth.service';
import type { User } from '../../core/models/auth.model';
import { MarketIndicesListPage } from './market-indices-list';

describe('MarketIndicesListPage', () => {
  let fixture: ComponentFixture<MarketIndicesListPage>;
  let component: MarketIndicesListPage;
  let api: {
    listIndexes: ReturnType<typeof vi.fn>;
    createIndex: ReturnType<typeof vi.fn>;
    getIndex: ReturnType<typeof vi.fn>;
    refreshIndex: ReturnType<typeof vi.fn>;
    deleteIndex: ReturnType<typeof vi.fn>;
  };
  let authUser: ReturnType<typeof signal<User | null>>;

  const rows: IndexListItem[] = [
    {
      id: 'idx-1',
      name: 'Quality Compounders',
      description: 'Durable earnings',
      theme: 'Quality',
      visibility: 'system',
      status: 'READY',
      value: 1234.56,
      dailyReturn: 0.0123,
      latestSnapshot: { date: '2026-06-25', value: 1234.56, dailyReturn: 0.0123 },
      constituentCount: 10,
    },
    {
      id: 'idx-2',
      name: 'My AI Basket',
      description: null,
      theme: 'AI',
      visibility: 'user',
      status: 'PARTIAL',
      value: 987.65,
      dailyReturn: -0.0553,
      latestSnapshot: null,
      constituentCount: 4,
    },
  ];

  beforeEach(async () => {
    authUser = signal({ email: 'admin@tradingbot.dev', name: 'Admin', isAdmin: true });
    api = {
      listIndexes: vi.fn(() => of(rows)),
      createIndex: vi.fn(() => of({ id: 'new-index', status: 'BUILDING' })),
      getIndex: vi.fn(() => of({
        id: 'new-index',
        name: 'New Index',
        visibility: 'user',
        status: 'READY',
        description: null,
        theme: null,
        statusMessage: null,
        value: 100,
        dailyReturn: 0,
        historyStatus: 'complete',
        constituents: [],
        dataQuality: {
          missingProfiles: [],
          missingPrices: [],
          usedCachedData: false,
          providerCallsUsed: 0,
          providerCallsRemaining: null,
        },
      } satisfies IndexDetails)),
      refreshIndex: vi.fn(() => of({ id: 'idx-1', status: 'BUILDING' })),
      deleteIndex: vi.fn(() => of({ deleted: true })),
    };

    await TestBed.configureTestingModule({
      imports: [MarketIndicesListPage],
      providers: [
        provideRouter([]),
        { provide: MarketIndicesApiService, useValue: api },
        { provide: AnalysisApiService, useValue: { searchInstruments: vi.fn(() => of([])) } },
        { provide: AuthService, useValue: { user: authUser } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketIndicesListPage);
    component = fixture.componentInstance;
  });

  it('renders list rows with loading resolved and admin system actions visible', () => {
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(api.listIndexes).toHaveBeenCalled();
    expect(text).toContain('Quality Compounders');
    expect(text).toContain('System');
    expect(text).toContain('1.23%');
    expect(text).toContain('-5.53%');
    expect(text).not.toContain('-553.00%');
    expect(text).toContain('Create System Index');
  });

  it('renders empty and error states', () => {
    api.listIndexes.mockReturnValueOnce(of([]));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No market indices found.');

    api.listIndexes.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ error: { message: 'Backend down' } })));
    component.load();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Backend down');
  });

  it('validates create input and supports symbol add and remove', () => {
    fixture.detectChanges();
    component.openCreate('user');
    component.createForm.controls.name.setValue('Focused Index');
    component.addSymbol({ displayTicker: 'AAPL', name: 'Apple' });
    component.submitCreate();
    expect(api.createIndex).not.toHaveBeenCalled();

    component.addSymbol({ displayTicker: 'MSFT', name: 'Microsoft' });
    component.removeSymbol('AAPL');
    expect(component.symbols()).toEqual(['MSFT']);
    component.addSymbol({ displayTicker: 'NVDA', name: 'Nvidia' });
    component.submitCreate();

    expect(api.createIndex).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Focused Index',
      visibility: 'user',
      symbols: ['MSFT', 'NVDA'],
      maxWeight: 0.25,
    }));
  });

  it('shows the System visibility option for admins', () => {
    fixture.detectChanges();
    component.openCreate('user');
    fixture.detectChanges();

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLSelectElement>('select[formControlName="visibility"] option'),
    ).map(option => option.textContent?.trim());

    expect(options).toEqual(['Custom', 'System']);
  });

  it('hides System from non-admin create flows', () => {
    authUser.set({ email: 'user@example.com', name: 'User' });
    fixture.detectChanges();
    component.openCreate('system');
    fixture.detectChanges();

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLSelectElement>('select[formControlName="visibility"] option'),
    ).map(option => option.textContent?.trim());

    expect(component.createForm.controls.visibility.value).toBe('user');
    expect(options).toEqual(['Custom']);
  });

  it('defaults max weight to 25 percent and submits 0.25', () => {
    fixture.detectChanges();
    component.openCreate('user');
    component.createForm.controls.name.setValue('Percent Index');
    component.addSymbol({ displayTicker: 'AAPL', name: 'Apple' });
    component.addSymbol({ displayTicker: 'MSFT', name: 'Microsoft' });
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[formControlName="maxWeightPercent"]');
    expect(input?.value).toBe('25');

    component.submitCreate();
    expect(api.createIndex).toHaveBeenCalledWith(expect.objectContaining({ maxWeight: 0.25 }));
  });

  it('polls after refresh until the index is ready', () => {
    vi.useFakeTimers();
    fixture.detectChanges();
    const buildingDetails: IndexDetails = {
      id: 'idx-1',
      name: 'Quality Compounders',
      visibility: 'system',
      status: 'BUILDING',
      description: null,
      theme: null,
      statusMessage: null,
      value: 100,
      dailyReturn: 0,
      historyStatus: 'complete',
      constituents: [],
      dataQuality: {
        missingProfiles: [],
        missingPrices: [],
        usedCachedData: false,
        providerCallsUsed: 0,
        providerCallsRemaining: null,
      },
    };
    api.getIndex
      .mockReturnValueOnce(of(buildingDetails))
      .mockReturnValueOnce(of({
        id: 'idx-1',
        name: 'Quality Compounders',
        visibility: 'system',
        status: 'READY',
        description: null,
        theme: null,
        statusMessage: null,
        value: 100,
        dailyReturn: 0,
        historyStatus: 'complete',
        constituents: [],
        dataQuality: {
          missingProfiles: [],
          missingPrices: [],
          usedCachedData: false,
          providerCallsUsed: 0,
          providerCallsRemaining: null,
        },
      } satisfies IndexDetails));

    component.refresh(rows[0]);
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(5000);

    expect(api.refreshIndex).toHaveBeenCalledWith('idx-1');
    expect(api.getIndex).toHaveBeenCalledWith('idx-1');
    expect(component.message()).toContain('READY');
    vi.useRealTimers();
  });

  it('confirms delete and shows friendly 403 errors', () => {
    fixture.detectChanges();
    component.askDelete(rows[1]);
    component.deleteConfirmed();
    expect(api.deleteIndex).toHaveBeenCalledWith('idx-2');

    api.deleteIndex.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } })));
    component.askDelete(rows[0]);
    component.deleteConfirmed();
    expect(component.error()).toContain('Forbidden');
  });
});
