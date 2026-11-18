import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export type AppInputType = 'text' | 'email' | 'number' | 'password';

let nextId = 0;

/** The team's text input. UI code uses <app-input> instead of a native or third-party input. */
@Component({
  selector: 'app-input',
  templateUrl: './app-input.html',
  styleUrl: './app-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppInput {
  readonly label = input.required<string>();
  readonly type = input<AppInputType>('text');
  readonly placeholder = input('');
  readonly value = model('');

  protected readonly id = `app-input-${nextId++}`;

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
