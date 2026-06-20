import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5">
      @if (title()) {
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{{ title() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class CardComponent {
  title = input<string>();
}
