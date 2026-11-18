import { TestBed } from '@angular/core/testing';
import { CustomerService } from '../domain/customer/customer.service';
import { ReportService } from './report.service';

describe('ReportService', () => {
  let reports: ReportService;

  beforeEach(() => {
    reports = TestBed.inject(ReportService);
  });

  it('summarises a customer with spending and loyalty points', () => {
    const customers = TestBed.inject(CustomerService);
    customers.addOrder(1, 45);
    customers.addOrder(1, 60);
    expect(reports.customerSummary(1)).toBe('Olena Kovalenko: spent 105, 10 loyalty points');
    expect(reports.customerSummary(99)).toBe('Unknown customer');
  });

  it('builds payroll and vacation lines', () => {
    expect(reports.payrollLine(1)).toBe('Iryna Bondar: 5000.00 per month');
    expect(reports.payrollLine(99)).toBe('Unknown employee');
    expect(reports.vacationLine(2)).toBe('24 vacation days left');
  });

  it('tells who can approve vacations', () => {
    expect(reports.canApproveVacations(1)).toBe(true);
    expect(reports.canApproveVacations(2)).toBe(false);
    expect(reports.canApproveVacations(99)).toBe(false);
  });

  it('formats the report title', () => {
    expect(reports.reportTitle(new Date('2026-11-18T10:00:00Z'))).toBe('Management report 2026-11');
  });
});
