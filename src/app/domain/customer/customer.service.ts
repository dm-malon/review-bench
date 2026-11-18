import { Injectable, signal } from '@angular/core';
import { Customer, Invoice, Order } from './customer.model';

/** Currency units a customer spends to earn one loyalty point. */
const SPEND_PER_LOYALTY_POINT = 10;

const SEED_CUSTOMERS: Customer[] = [
  { id: 1, name: 'Olena Kovalenko', email: 'olena@example.com' },
  { id: 2, name: 'Taras Shevchuk', email: 'taras@example.com' },
];

/** Owns everything about customers: profiles, orders, loyalty points and invoices. */
@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly customers = signal<Customer[]>([...SEED_CUSTOMERS]);
  private readonly orders = signal<Order[]>([]);

  readonly all = this.customers.asReadonly();

  getCustomer(id: number): Customer | undefined {
    return this.customers().find((customer) => customer.id === id);
  }

  addCustomer(name: string, email: string): Customer {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      throw new Error('Customer name is required.');
    }
    if (!trimmedEmail.includes('@')) {
      throw new Error('Customer email is not valid.');
    }
    const customer: Customer = {
      id: this.nextId(this.customers()),
      name: trimmedName,
      email: trimmedEmail,
    };
    this.customers.update((list) => [...list, customer]);
    return customer;
  }

  addOrder(customerId: number, amount: number): Order {
    this.requireCustomer(customerId);
    if (amount <= 0) {
      throw new Error('Order amount must be positive.');
    }
    const order: Order = { id: this.nextId(this.orders()), customerId, amount };
    this.orders.update((list) => [...list, order]);
    return order;
  }

  getOrders(customerId: number): Order[] {
    return this.orders().filter((order) => order.customerId === customerId);
  }

  loyaltyPoints(customerId: number): number {
    return Math.floor(this.totalSpent(customerId) / SPEND_PER_LOYALTY_POINT);
  }

  createInvoice(customerId: number): Invoice {
    this.requireCustomer(customerId);
    const orders = this.getOrders(customerId);
    return {
      customerId,
      orderIds: orders.map((order) => order.id),
      total: this.totalSpent(customerId),
    };
  }

  private totalSpent(customerId: number): number {
    return this.getOrders(customerId).reduce((sum, order) => sum + order.amount, 0);
  }

  private requireCustomer(id: number): Customer {
    const customer = this.getCustomer(id);
    if (!customer) {
      throw new Error(`Customer ${id} does not exist.`);
    }
    return customer;
  }

  private nextId(items: readonly { id: number }[]): number {
    return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  }
}
