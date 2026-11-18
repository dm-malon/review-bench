import { TestBed } from '@angular/core/testing';
import { CustomerService } from './customer.service';

describe('CustomerService', () => {
  let service: CustomerService;

  beforeEach(() => {
    service = TestBed.inject(CustomerService);
  });

  it('starts with seed customers', () => {
    expect(service.all().map((c) => c.name)).toEqual(['Olena Kovalenko', 'Taras Shevchuk']);
    expect(service.getCustomer(1)?.email).toBe('olena@example.com');
    expect(service.getCustomer(99)).toBeUndefined();
  });

  it('adds a customer with trimmed fields', () => {
    const customer = service.addCustomer('  Iryna Bondar ', ' iryna@example.com ');
    expect(customer).toEqual({ id: 3, name: 'Iryna Bondar', email: 'iryna@example.com' });
    expect(service.all()).toContainEqual(customer);
  });

  it('rejects a customer without a name or a valid email', () => {
    expect(() => service.addCustomer(' ', 'a@b.c')).toThrow('name is required');
    expect(() => service.addCustomer('Name', 'not-an-email')).toThrow('email is not valid');
  });

  it('records orders and counts loyalty points', () => {
    service.addOrder(1, 45);
    service.addOrder(1, 60);
    service.addOrder(2, 5);
    expect(service.getOrders(1).map((o) => o.amount)).toEqual([45, 60]);
    expect(service.loyaltyPoints(1)).toBe(10);
    expect(service.loyaltyPoints(2)).toBe(0);
  });

  it('rejects orders for unknown customers or with a non-positive amount', () => {
    expect(() => service.addOrder(99, 10)).toThrow('Customer 99 does not exist');
    expect(() => service.addOrder(1, 0)).toThrow('must be positive');
  });

  it('creates an invoice for all orders of a customer', () => {
    const first = service.addOrder(2, 20);
    const second = service.addOrder(2, 30);
    expect(service.createInvoice(2)).toEqual({
      customerId: 2,
      orderIds: [first.id, second.id],
      total: 50,
    });
    expect(() => service.createInvoice(99)).toThrow('does not exist');
  });
});
