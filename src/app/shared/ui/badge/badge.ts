import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeVariant =
  | 'demo' | 'live' | 'dry-run' | 'live-trading'
  | 'running' | 'paused' | 'stopped' | 'error'
  | 'executed' | 'failed' | 'skipped' | 'aborted'
  | 'healthy' | 'warning' | 'critical' | 'backing-off'
  | 'default';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  demo:         'bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30',
  live:         'bg-orange-500/15 text-orange-300 ring-1 ring-inset ring-orange-500/30',
  'dry-run':    'bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-500/30',
  'live-trading':'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30',
  running:      'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
  paused:       'bg-yellow-500/15 text-yellow-300 ring-1 ring-inset ring-yellow-500/30',
  stopped:      'bg-slate-600/15 text-slate-400 ring-1 ring-inset ring-slate-600/30',
  error:        'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30',
  executed:     'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
  failed:       'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30',
  skipped:      'bg-slate-500/15 text-slate-400 ring-1 ring-inset ring-slate-500/30',
  aborted:      'bg-orange-500/15 text-orange-300 ring-1 ring-inset ring-orange-500/30',
  healthy:      'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30',
  warning:      'bg-yellow-500/15 text-yellow-300 ring-1 ring-inset ring-yellow-500/30',
  critical:     'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30',
  'backing-off':'bg-orange-500/15 text-orange-300 ring-1 ring-inset ring-orange-500/30',
  default:      'bg-slate-700 text-slate-300',
};

@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="classes()">{{ label() }}</span>`,
})
export class BadgeComponent {
  label = input.required<string>();
  variant = input<BadgeVariant>('default');

  classes = computed(
    () =>
      `inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${VARIANT_CLASSES[this.variant()]}`,
  );
}
