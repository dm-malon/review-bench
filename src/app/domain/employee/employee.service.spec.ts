import { TestBed } from '@angular/core/testing';
import { EmployeeService } from './employee.service';

describe('EmployeeService', () => {
  let service: EmployeeService;

  beforeEach(() => {
    service = TestBed.inject(EmployeeService);
  });

  it('starts with seed employees', () => {
    expect(service.all().map((e) => e.name)).toEqual(['Iryna Bondar', 'Andrii Melnyk']);
    expect(service.getEmployee(2)?.role).toBe('staff');
    expect(service.getEmployee(99)).toBeUndefined();
  });

  it('hires an employee with default vacation days', () => {
    const employee = service.hireEmployee(' Oksana Lysenko ', 'staff', 36000);
    expect(employee).toMatchObject({
      id: 3,
      name: 'Oksana Lysenko',
      vacationDaysPerYear: 24,
      vacationDaysTaken: 0,
    });
    expect(service.all()).toContainEqual(employee);
  });

  it('rejects hiring without a name or with a non-positive salary', () => {
    expect(() => service.hireEmployee(' ', 'staff', 1000)).toThrow('name is required');
    expect(() => service.hireEmployee('Name', 'staff', 0)).toThrow('Salary must be positive');
  });

  it('calculates the monthly salary', () => {
    expect(service.monthlySalary(1)).toBe(5000);
    expect(service.monthlySalary(2)).toBe(3500);
    expect(() => service.monthlySalary(99)).toThrow('Employee 99 does not exist');
  });

  it('books vacation only when enough days are left', () => {
    expect(service.remainingVacationDays(1)).toBe(20);
    expect(service.requestVacation(1, 5)).toBe(true);
    expect(service.remainingVacationDays(1)).toBe(15);
    expect(service.requestVacation(1, 16)).toBe(false);
    expect(service.remainingVacationDays(1)).toBe(15);
    expect(() => service.requestVacation(1, 0)).toThrow('at least one day');
  });

  it('assigns roles and checks permissions', () => {
    expect(service.hasPermission(2, 'view-reports')).toBe(false);
    service.assignRole(2, 'admin');
    expect(service.hasPermission(2, 'manage-salaries')).toBe(true);
    expect(service.hasPermission(1, 'manage-salaries')).toBe(false);
    expect(() => service.assignRole(99, 'staff')).toThrow('does not exist');
  });
});
