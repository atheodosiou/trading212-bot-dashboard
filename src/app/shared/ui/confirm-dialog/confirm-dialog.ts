import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="'confirm-title-' + dialogId()"
      >
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="onCancel()"></div>
        <div class="relative w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-6">
          <div class="flex items-start gap-4 mb-4">
            @if (danger()) {
              <div class="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center" aria-hidden="true">
                <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
            }
            <div>
              <h2 [id]="'confirm-title-' + dialogId()" class="text-lg font-semibold text-white">{{ title() }}</h2>
              <p class="text-slate-400 text-sm mt-1">{{ message() }}</p>
            </div>
          </div>

          @if (danger() && warningText()) {
            <div class="mb-5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
              {{ warningText() }}
            </div>
          }

          <div class="flex gap-3 justify-end">
            <button
              type="button"
              (click)="onCancel()"
              class="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              {{ cancelLabel() }}
            </button>
            <button
              type="button"
              (click)="onConfirm()"
              [class]="confirmBtnClass()"
            >
              {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  open        = input.required<boolean>();
  title       = input.required<string>();
  message     = input.required<string>();
  danger      = input<boolean>(false);
  warningText = input<string>('');
  confirmLabel = input<string>('Confirm');
  cancelLabel  = input<string>('Cancel');
  dialogId     = input<string>('dialog');

  confirmed = output<void>();
  cancelled = output<void>();

  confirmBtnClass = computed(() => {
    const base = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2';
    return this.danger()
      ? `${base} bg-red-600 hover:bg-red-700 text-white focus:ring-red-500`
      : `${base} bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500`;
  });

  onConfirm(): void { this.confirmed.emit(); }
  onCancel(): void  { this.cancelled.emit(); }
}
