import { Injectable, inject } from '@angular/core';
import { CustomerService } from '../domain/customer/customer.service';
import { EmployeeService } from '../domain/employee/employee.service';

/** Builds short text lines for the monthly management report. */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly customers = inject(CustomerService);
  private readonly employees = inject(EmployeeService);

  customerSummary(customerId: number): string {
    const customer = this.customers.getCustomer(customerId);
    if (!customer) {
      return 'Unknown customer';
    }
    const orders = this.customers.getOrders(customerId);
    const total = orders.reduce((sum, order) => sum + order.amount, 0);
    const points = Math.floor(total / 10);
    return `${customer.name}: spent ${total}, ${points} loyalty points`;
  }

  payrollLine(employeeId: number): string {
    const employee = this.employees.getEmployee(employeeId);
    if (!employee) {
      return 'Unknown employee';
    }
    const monthly = Math.round((employee.annualSalary / 12) * 100) / 100;
    return `${employee.name}: ${monthly.toFixed(2)} per month`;
  }

  vacationLine(employeeId: number): string {
    return `${this.employees.remainingVacationDays(employeeId)} vacation days left`;
  }

  canApproveVacations(employeeId: number): boolean {
    const employee = this.employees.getEmployee(employeeId);
    return employee?.role === 'manager' || employee?.role === 'admin';
  }

  reportTitle(date: Date): string {
    return `Management report ${date.toISOString().slice(0, 7)}`;
  }
}
