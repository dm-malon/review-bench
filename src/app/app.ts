import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CustomerService } from './domain/customer/customer.service';
import { AppInput } from './shared/ui/input/app-input';

@Component({
  selector: 'app-root',
  imports: [AppInput],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly customers = inject(CustomerService);
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly error = signal<string | null>(null);

  protected addCustomer(): void {
    try {
      this.customers.addCustomer(this.name(), this.email());
      this.name.set('');
      this.email.set('');
      this.error.set(null);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not add the customer.');
    }
  }
}
