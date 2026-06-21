import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const MIN_SCORE = 0;
const MAX_SCORE = 100;
const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

@Component({
  selector: 'app-score-gauge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inline-flex max-w-full flex-col items-center">
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        viewBox="0 0 120 120"
        class="max-w-full"
        role="img"
        [attr.aria-label]="'Score ' + formattedScore() + ' out of 100'"
      >
        <circle
          cx="60"
          cy="60"
          [attr.r]="radius"
          fill="none"
          stroke="currentColor"
          stroke-width="10"
          class="text-slate-700"
        />
        <circle
          cx="60"
          cy="60"
          [attr.r]="radius"
          fill="none"
          [attr.stroke]="arcColor()"
          stroke-width="10"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="dashOffset()"
          transform="rotate(-90 60 60)"
        />
        <text
          x="60"
          y="57"
          text-anchor="middle"
          dominant-baseline="middle"
          class="fill-white font-semibold"
          font-size="26"
        >
          {{ formattedScore() }}
        </text>
        <text
          x="60"
          y="78"
          text-anchor="middle"
          dominant-baseline="middle"
          class="fill-slate-500"
          font-size="10"
          letter-spacing="0"
        >
          / 100
        </text>
      </svg>

      @if (showLabel()) {
        <div class="mt-2 text-center text-sm font-semibold text-slate-200">
          <ng-content />
        </div>
      }
    </div>
  `,
})
export class ScoreGaugeComponent {
  readonly score = input.required<number>();
  readonly size = input(220);
  readonly showLabel = input(true);

  readonly radius = RADIUS;
  readonly circumference = CIRCUMFERENCE;

  readonly normalizedScore = computed(() =>
    Math.min(MAX_SCORE, Math.max(MIN_SCORE, this.score())),
  );
  readonly dashOffset = computed(() =>
    CIRCUMFERENCE * (1 - this.normalizedScore() / MAX_SCORE),
  );
  readonly formattedScore = computed(() =>
    this.normalizedScore().toLocaleString('en-GB', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  );
  readonly arcColor = computed(() => {
    const score = this.normalizedScore();
    if (score >= 80) return '#34d399';
    if (score >= 60) return '#facc15';
    if (score >= 40) return '#fb923c';
    return '#f87171';
  });
}
