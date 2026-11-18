export type EmployeeRole = 'staff' | 'manager' | 'admin';

export type Permission = 'view-reports' | 'approve-vacations' | 'manage-salaries';

export interface Employee {
  id: number;
  name: string;
  role: EmployeeRole;
  annualSalary: number;
  vacationDaysPerYear: number;
  vacationDaysTaken: number;
}
