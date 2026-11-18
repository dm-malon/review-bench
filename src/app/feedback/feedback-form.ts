import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { AppInput } from '../shared/ui/input/app-input';

export interface Feedback {
  name: string;
  email: string;
  message: string;
  subscribe: boolean;
}

@Component({
  selector: 'app-feedback-form',
  imports: [AppInput],
  templateUrl: './feedback-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackForm {
  readonly submitted = output<Feedback>();

  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly message = signal('');
  protected readonly subscribe = signal(false);
  protected readonly error = signal<string | null>(null);

  protected onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  protected onMessageInput(event: Event): void {
    this.message.set((event.target as HTMLTextAreaElement).value);
  }

  protected onSubscribeChange(event: Event): void {
    this.subscribe.set((event.target as HTMLInputElement).checked);
  }

  protected submit(): void {
    if (!this.name().trim() || !this.message().trim()) {
      this.error.set('Name and message are required.');
      return;
    }
    this.submitted.emit({
      name: this.name().trim(),
      email: this.email().trim(),
      message: this.message().trim(),
      subscribe: this.subscribe(),
    });
    this.name.set('');
    this.email.set('');
    this.message.set('');
    this.error.set(null);
  }
}
