import { Injectable, signal } from '@angular/core';
import { Employee, EmployeeRole, Permission } from './employee.model';

const DEFAULT_VACATION_DAYS = 24;

const ROLE_PERMISSIONS: Record<EmployeeRole, readonly Permission[]> = {
  staff: [],
  manager: ['view-reports', 'approve-vacations'],
  admin: ['view-reports', 'approve-vacations', 'manage-salaries'],
};

const SEED_EMPLOYEES: Employee[] = [
  {
    id: 1,
    name: 'Iryna Bondar',
    role: 'manager',
    annualSalary: 60000,
    vacationDaysPerYear: 24,
    vacationDaysTaken: 4,
  },
  {
    id: 2,
    name: 'Andrii Melnyk',
    role: 'staff',
    annualSalary: 42000,
    vacationDaysPerYear: 24,
    vacationDaysTaken: 0,
  },
];

/** Owns everything about employees: hiring, salaries, vacations, roles and permissions. */
@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly employees = signal<Employee[]>([...SEED_EMPLOYEES]);

  readonly all = this.employees.asReadonly();

  getEmployee(id: number): Employee | undefined {
    return this.employees().find((employee) => employee.id === id);
  }

  hireEmployee(name: string, role: EmployeeRole, annualSalary: number): Employee {
    if (!name.trim()) {
      throw new Error('Employee name is required.');
    }
    if (annualSalary <= 0) {
      throw new Error('Salary must be positive.');
    }
    const employee: Employee = {
      id: this.employees().reduce((max, e) => Math.max(max, e.id), 0) + 1,
      name: name.trim(),
      role,
      annualSalary,
      vacationDaysPerYear: DEFAULT_VACATION_DAYS,
      vacationDaysTaken: 0,
    };
    this.employees.update((list) => [...list, employee]);
    return employee;
  }

  monthlySalary(id: number): number {
    return Math.round((this.requireEmployee(id).annualSalary / 12) * 100) / 100;
  }

  remainingVacationDays(id: number): number {
    const employee = this.requireEmployee(id);
    return employee.vacationDaysPerYear - employee.vacationDaysTaken;
  }

  /** Books vacation days if enough are left; returns whether the request was approved. */
  requestVacation(id: number, days: number): boolean {
    if (days <= 0) {
      throw new Error('Vacation must be at least one day.');
    }
    if (days > this.remainingVacationDays(id)) {
      return false;
    }
    this.update(id, (employee) => ({
      ...employee,
      vacationDaysTaken: employee.vacationDaysTaken + days,
    }));
    return true;
  }

  assignRole(id: number, role: EmployeeRole): void {
    this.requireEmployee(id);
    this.update(id, (employee) => ({ ...employee, role }));
  }

  hasPermission(id: number, permission: Permission): boolean {
    return ROLE_PERMISSIONS[this.requireEmployee(id).role].includes(permission);
  }

  private update(id: number, change: (employee: Employee) => Employee): void {
    this.employees.update((list) =>
      list.map((employee) => (employee.id === id ? change(employee) : employee)),
    );
  }

  private requireEmployee(id: number): Employee {
    const employee = this.getEmployee(id);
    if (!employee) {
      throw new Error(`Employee ${id} does not exist.`);
    }
    return employee;
  }
}
