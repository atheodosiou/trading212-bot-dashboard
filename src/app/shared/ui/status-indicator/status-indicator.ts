import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type StatusType = 'running' | 'paused' | 'stopped' | 'error' | 'open' | 'closed' | 'healthy' | 'warning' | 'critical';

type StatusConfig = { dot: string; text: string };

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  running:  { dot: 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse', text: 'text-emerald-400 text-sm font-medium' },
  paused:   { dot: 'w-2 h-2 rounded-full bg-yellow-400',                text: 'text-yellow-400 text-sm font-medium' },
  stopped:  { dot: 'w-2 h-2 rounded-full bg-slate-500',                 text: 'text-slate-400 text-sm font-medium' },
  error:    { dot: 'w-2 h-2 rounded-full bg-red-400 animate-pulse',     text: 'text-red-400 text-sm font-medium' },
  open:     { dot: 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse', text: 'text-emerald-400 text-sm font-medium' },
  closed:   { dot: 'w-2 h-2 rounded-full bg-slate-500',                 text: 'text-slate-400 text-sm font-medium' },
  healthy:  { dot: 'w-2 h-2 rounded-full bg-emerald-400',               text: 'text-emerald-400 text-sm font-medium' },
  warning:  { dot: 'w-2 h-2 rounded-full bg-yellow-400',                text: 'text-yellow-400 text-sm font-medium' },
  critical: { dot: 'w-2 h-2 rounded-full bg-red-400 animate-pulse',     text: 'text-red-400 text-sm font-medium' },
};

@Component({
  selector: 'app-status-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-2">
      <span [class]="cfg().dot" aria-hidden="true"></span>
      <span [class]="cfg().text">{{ label() }}</span>
    </span>
  `,
})
export class StatusIndicatorComponent {
  status = input.required<StatusType>();
  label = input.required<string>();

  cfg = computed(() => STATUS_CONFIG[this.status()]);
}
