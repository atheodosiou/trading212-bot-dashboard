import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ValuationCenterApiService } from '../../services/valuation-center-api.service';
import type { VixFearGauge } from '../../models/vix-fear-gauge.model';

const MIN_SCORE = 0;
const MAX_SCORE = 100;

@Component({
  selector: 'app-vix-fear-gauge-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block mb-5',
  },
  templateUrl: './vix-fear-gauge-widget.component.html',
})
export class VixFearGaugeWidgetComponent implements OnInit {
  private readonly api = inject(ValuationCenterApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly gauge = signal<VixFearGauge | null>(null);

  readonly score = computed(() => this.clampScore(this.gauge()?.fearScore));
  readonly scoreDashOffset = computed(() => MAX_SCORE - this.score());
  readonly scoreClasses = computed(() => this.fearScoreClasses(this.score()));
  readonly previousCloseText = computed(() => {
    const current = this.gauge();
    const previous = current?.previousClose;
    if (!current || !previous) return '';

    const delta = current.value - previous.value;
    const direction = delta > 0 ? 'higher' : delta < 0 ? 'lower' : 'unchanged';
    const formattedDelta = Math.abs(delta).toLocaleString('en-GB', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });

    return direction === 'unchanged'
      ? `Unchanged from previous close (${this.formatVix(previous.value)})`
      : `${formattedDelta} ${direction} than previous close (${this.formatVix(previous.value)})`;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    this.api.getVixFearGauge().subscribe({
      next: gauge => {
        this.gauge.set(gauge);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.gauge.set(null);
        this.error.set(this.endpointErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  formatVix(value: number | null | undefined): string {
    if (value == null) return '-';
    return value.toLocaleString('en-GB', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }

  formatScore(value: number | null | undefined): string {
    if (value == null) return '-';
    return this.clampScore(value).toLocaleString('en-GB', {
      maximumFractionDigits: 0,
    });
  }

  formatPercentile(value: number | null | undefined): string {
    if (value == null) return '-';
    const rounded = Math.round(value);
    const suffix = this.ordinalSuffix(rounded);
    return `${rounded.toLocaleString('en-GB')}${suffix} percentile`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-GB');
  }

  private fearScoreClasses(score: number): string {
    if (score <= 20) return 'text-red-300';
    if (score <= 40) return 'text-orange-300';
    if (score <= 60) return 'text-yellow-300';
    return 'text-emerald-300';
  }

  private clampScore(value: number | null | undefined): number {
    if (value == null || Number.isNaN(value)) return MIN_SCORE;
    return Math.min(MAX_SCORE, Math.max(MIN_SCORE, value));
  }

  private ordinalSuffix(value: number): string {
    const mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) return 'th';

    switch (value % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  }

  private endpointErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Market fear data could not be reached. Check your connection and try again.';
    }

    if (err.status === 404) {
      return 'Market fear data is not available from this server yet.';
    }

    if (err.status === 429) {
      return 'Market fear data is temporarily rate-limited. Please try again shortly.';
    }

    return 'Market fear data is temporarily unavailable. Please try again later.';
  }
}
