import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  of,
  switchMap,
  takeUntil,
} from 'rxjs';
import {
  AnalysisApiService,
  type AnalysisCategory,
  type AnalysisCategories,
  type AnalysisInstrumentSearchResult,
  type AnalysisMetric,
  type AnalysisProfile,
  type AnalysisProfileWeights,
  type AnalysisReport,
  type AnalysisStatus,
  type ResearchDriverCategory,
  type ResearchDriverType,
  type ResearchMacroAlignment,
  type ResearchOverallView,
} from '../../core/api/analysis-api.service';
import { ScoreGaugeComponent } from '../../shared/ui/score-gauge/score-gauge';
import { VixFearGaugeWidgetComponent } from './components/vix-fear-gauge-widget/vix-fear-gauge-widget.component';
import {
  ValuationCenterStateService,
  type SelectedInstrument,
} from './valuation-center-state.service';

interface CategoryCard {
  label: string;
  score: number | null;
  metrics: AnalysisMetric[];
}

interface ProfileWeightLine {
  label: string;
  value: number;
}

@Component({
  selector: 'app-valuation-center',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScoreGaugeComponent, VixFearGaugeWidgetComponent],
  templateUrl: './valuation-center.html',
})
export class ValuationCenterPage implements OnDestroy {
  private readonly analysisApi = inject(AnalysisApiService);
  private readonly state = inject(ValuationCenterStateService);
  private readonly searchTerms = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  readonly query = this.state.query;
  readonly searchLoading = signal(false);
  readonly searchError = signal('');
  readonly searchResults = signal<AnalysisInstrumentSearchResult[]>([]);
  readonly profilesLoading = signal(false);
  readonly profilesError = signal('');
  readonly profiles = signal<AnalysisProfile[]>([]);
  readonly selectedProfileId = this.state.selectedProfileId;
  readonly selectedInstrument = this.state.selectedInstrument;
  readonly reportLoading = signal(false);
  readonly reportError = signal('');
  readonly report = this.state.report;
  readonly showResults = signal(false);

  readonly canGenerate = computed(() => this.selectedInstrument() !== null && !this.reportLoading());
  readonly selectedProfile = computed(() =>
    this.profiles().find(profile => this.profileId(profile) === this.selectedProfileId()) ?? null,
  );
  readonly reportProfile = computed(() => this.report()?.profile ?? null);
  readonly activeProfile = computed(() => this.reportProfile() ?? this.selectedProfile());
  readonly profileWeightLines = computed<ProfileWeightLine[]>(() => {
    const weights = this.activeProfile()?.weights;
    return weights ? this.weightLines(weights) : [];
  });
  readonly companyName = computed(() => {
    const report = this.report();
    const selected = this.selectedInstrument();
    return report?.companyName?.trim() || report?.name?.trim() || selected?.name || 'Selected stock';
  });
  readonly strengths = computed(() => this.insightsValue(this.report()?.strengths));
  readonly weaknesses = computed(() => this.insightsValue(this.report()?.weaknesses));
  readonly research = computed(() => this.report()?.research ?? null);
  readonly overallScore = computed(() => this.scoreValue(this.report()?.overallScore));
  readonly status = computed(() => this.statusValue(this.report()?.status));
  readonly categoryCards = computed<CategoryCard[]>(() => {
    const report = this.report();
    return [
      this.categoryCard(report, 'Business Quality', 'businessQuality'),
      this.categoryCard(report, 'Financial Health', 'financialHealth'),
      this.categoryCard(report, 'Valuation', 'valuation'),
      this.categoryCard(report, 'Momentum', 'momentum'),
      this.categoryCard(report, 'Risk', 'risk'),
    ];
  });

  constructor() {
    this.loadProfiles();

    this.searchTerms.pipe(
      map(term => term.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      filter(term => {
        if (term.length >= 2) return true;
        this.searchLoading.set(false);
        this.searchError.set('');
        this.searchResults.set([]);
        this.showResults.set(false);
        return false;
      }),
      switchMap(term => {
        this.searchLoading.set(true);
        this.searchError.set('');
        return this.analysisApi.searchInstruments(term).pipe(
          catchError((err: HttpErrorResponse) => {
            this.searchError.set(this.extractMessage(err, 'Failed to search instruments.'));
            return of(<AnalysisInstrumentSearchResult[]>[]);
          }),
        );
      }),
      takeUntil(this.destroy$),
    ).subscribe(results => {
      this.searchResults.set(results);
      this.showResults.set(results.length > 0);
      this.searchLoading.set(false);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(value: string): void {
    this.query.set(value);
    this.selectedInstrument.set(null);
    this.report.set(null);
    this.reportError.set('');
    this.searchTerms.next(value);
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.onSearch(input?.value ?? '');
  }

  onProfileChange(event: Event): void {
    const select = event.target as HTMLSelectElement | null;
    this.selectedProfileId.set(select?.value ?? '');
    this.report.set(null);
    this.reportError.set('');
  }

  selectInstrument(result: AnalysisInstrumentSearchResult): void {
    const selected = this.toSelectedInstrument(result);
    this.selectedInstrument.set(selected);
    this.query.set(selected.displayTicker);
    this.searchResults.set([]);
    this.showResults.set(false);
    this.searchError.set('');
    this.report.set(null);
    this.reportError.set('');
  }

  generateReport(): void {
    const selected = this.selectedInstrument();
    if (!selected) return;

    this.reportLoading.set(true);
    this.reportError.set('');

    const profileId = this.selectedProfileId() || undefined;
    this.analysisApi.getReport(selected.displayTicker, profileId).subscribe({
      next: report => {
        this.report.set(report);
        this.reportLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.report.set(null);
        this.reportError.set(this.extractMessage(err, 'No report available.'));
        this.reportLoading.set(false);
      },
    });
  }

  refreshReport(): void {
    this.generateReport();
  }

  resultSymbol(result: AnalysisInstrumentSearchResult): string {
    return result.displayTicker?.trim() || result.ticker?.trim() || '-';
  }

  resultName(result: AnalysisInstrumentSearchResult): string {
    return result.name?.trim() || 'Unknown company';
  }

  resultMeta(result: AnalysisInstrumentSearchResult): string {
    return [result.exchange?.trim(), result.currency?.trim()].filter(Boolean).join(' / ') || '-';
  }

  statusClasses(status: AnalysisStatus | 'Unknown'): string {
    switch (status) {
      case 'Excellent':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'Strong Candidate':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
      case 'Watchlist':
        return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30';
      case 'Speculative':
        return 'bg-orange-500/10 text-orange-300 border-orange-500/30';
      case 'Avoid For Now':
        return 'bg-red-500/10 text-red-300 border-red-500/30';
      default:
        return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
    }
  }

  formatScore(value: number | null): string {
    if (value == null) return '-';
    return value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB');
  }

  formatWeight(value: number): string {
    const percent = value <= 1 ? value * 100 : value;
    return `${percent.toLocaleString('en-GB', { maximumFractionDigits: 1 })}%`;
  }

  metricLabel(metric: AnalysisMetric): string {
    return metric.label?.trim() || metric.key?.trim() || 'Unknown metric';
  }

  formatMetricValue(metric: AnalysisMetric): string {
    if (metric.value === null || metric.value === undefined) return '-';

    const unit = metric.unit?.trim();
    const formatted = this.formatNumber(metric.value);

    if (unit === '%') return `${formatted}%`;
    if (unit) return `${formatted} ${unit}`;

    return formatted;
  }

  formatMetricScore(score: number | null | undefined): string {
    if (score === null || score === undefined) return '-';
    return score.toLocaleString('en-GB', { maximumFractionDigits: 1 });
  }

  metricNote(metric: AnalysisMetric): string {
    return metric.note?.trim() ?? '';
  }

  formatConfidence(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    const percent = value <= 1 ? value * 100 : value;
    return `${percent.toLocaleString('en-GB', { maximumFractionDigits: 0 })}%`;
  }

  overallViewLabel(view: ResearchOverallView | string): string {
    switch (view) {
      case 'bullish':
        return 'Bullish';
      case 'bearish':
        return 'Bearish';
      default:
        return 'Neutral';
    }
  }

  macroAlignmentLabel(alignment: ResearchMacroAlignment | string): string {
    switch (alignment) {
      case 'supportive':
        return 'Supportive';
      case 'restrictive':
        return 'Restrictive';
      default:
        return 'Neutral';
    }
  }

  categoryLabel(category: ResearchDriverCategory | string): string {
    switch (category) {
      case 'business':
        return 'Business';
      case 'financial':
        return 'Financial';
      case 'valuation':
        return 'Valuation';
      case 'momentum':
        return 'Momentum';
      case 'risk':
        return 'Risk';
      case 'macro':
        return 'Macro';
      default:
        return category;
    }
  }

  overallViewClasses(view: ResearchOverallView | string): string {
    switch (view) {
      case 'bullish':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'bearish':
        return 'bg-red-500/10 text-red-300 border-red-500/30';
      default:
        return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
    }
  }

  macroAlignmentClasses(alignment: ResearchMacroAlignment | string): string {
    switch (alignment) {
      case 'supportive':
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      case 'restrictive':
        return 'bg-orange-500/10 text-orange-300 border-orange-500/30';
      default:
        return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
    }
  }

  driverClasses(type: ResearchDriverType | string): string {
    switch (type) {
      case 'positive':
        return 'border-emerald-500/30 bg-emerald-500/10';
      case 'negative':
        return 'border-red-500/30 bg-red-500/10';
      default:
        return 'border-yellow-500/30 bg-yellow-500/10';
    }
  }

  driverTextClasses(type: ResearchDriverType | string): string {
    switch (type) {
      case 'positive':
        return 'text-emerald-300';
      case 'negative':
        return 'text-red-300';
      default:
        return 'text-yellow-300';
    }
  }

  isScoreSuccess(value: number | null): boolean {
    return value !== null && value >= 80;
  }

  isScoreWarning(value: number | null): boolean {
    return value !== null && value >= 60 && value < 80;
  }

  isScoreOrange(value: number | null): boolean {
    return value !== null && value >= 40 && value < 60;
  }

  isScoreDanger(value: number | null): boolean {
    return value !== null && value < 40;
  }

  profileId(profile: AnalysisProfile): string {
    return profile.id?.trim() || profile.profileId?.trim() || profile._id?.trim() || '';
  }

  private loadProfiles(): void {
    this.profilesLoading.set(true);
    this.profilesError.set('');

    this.analysisApi.getProfiles().subscribe({
      next: profiles => {
        this.profiles.set(Array.isArray(profiles) ? profiles : []);
        this.profilesLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.profiles.set([]);
        this.profilesError.set(this.extractMessage(err, 'Failed to load analysis profiles.'));
        this.profilesLoading.set(false);
      },
    });
  }

  private toSelectedInstrument(result: AnalysisInstrumentSearchResult): SelectedInstrument {
    const displayTicker = result.displayTicker?.trim() || result.ticker?.trim() || '';
    return {
      displayTicker,
      internalTicker: result.internalTicker?.trim() || result.ticker?.trim() || displayTicker,
      name: result.name?.trim() || 'Unknown company',
      isin: result.isin?.trim() || '-',
      currency: result.currency?.trim() || '-',
      exchange: result.exchange?.trim() || '',
    };
  }

  private categoryCard(
    report: AnalysisReport | null,
    label: string,
    key: keyof AnalysisCategories,
  ): CategoryCard {
    const value = report?.categories[key] ?? null;
    return {
      label,
      score: this.scoreValue(value),
      metrics: this.metricsValue(value?.metricsUsed),
    };
  }

  private scoreValue(value: number | AnalysisCategory | null | undefined): number | null {
    if (typeof value === 'number') return value;
    if (value?.score === null || value?.score === undefined) return null;
    return value.score;
  }

  private metricsValue(metrics: AnalysisMetric[] | null | undefined): AnalysisMetric[] {
    if (metrics === null || metrics === undefined) return [];
    return metrics.filter(metric =>
      Boolean(metric.key?.trim() || metric.label?.trim()),
    );
  }

  private insightsValue(items: string[] | null | undefined): string[] {
    return items?.map(item => item.trim()).filter(Boolean) ?? [];
  }

  private formatNumber(value: number): string {
    return value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  }

  private weightLines(weights: AnalysisProfileWeights): ProfileWeightLine[] {
    return [
      { label: 'Business Quality', value: weights.businessQuality },
      { label: 'Financial Health', value: weights.financialHealth },
      { label: 'Valuation', value: weights.valuation },
      { label: 'Momentum', value: weights.momentum },
      { label: 'Risk', value: weights.risk },
    ];
  }

  private statusValue(status: AnalysisReport['status']): AnalysisStatus | 'Unknown' {
    switch (status) {
      case 'Excellent':
      case 'Strong Candidate':
      case 'Watchlist':
      case 'Speculative':
      case 'Avoid For Now':
        return status;
      default:
        return 'Unknown';
    }
  }

  private extractMessage(err: HttpErrorResponse, fallback: string): string {
    const body = err.error as { message?: string | string[] } | null;
    if (!body) return fallback;
    const msg = body.message;
    if (Array.isArray(msg)) return msg.join(' ');
    return msg ?? fallback;
  }
}
