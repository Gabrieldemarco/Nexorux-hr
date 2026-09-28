import { CountryCode, LeaveType } from '../domain/types';

export interface TaxDeductionItem {
  name: string;
  code: string;
  rate: number; // e.g. 0.15 for 15%
  amount: number;
  type: 'EMPLOYEE' | 'EMPLOYER';
}

export interface PayrollCalculationInput {
  baseSalary: number;
  workedDays: number;
  totalDaysInMonth: number;
  regularHours: number;
  overtimeHours: number;
  overtimePayRate?: number;
  seniorityYears: number;
  dependentsCount?: number;
  hasSpouse?: boolean;
}

export interface PayrollCalculationResult {
  countryCode: CountryCode;
  grossSalary: number;
  overtimeEarnings: number;
  statutoryBonus: number;
  totalGross: number;
  employeeDeductions: TaxDeductionItem[];
  totalEmployeeDeductions: number;
  netSalary: number;
  employerContributions: TaxDeductionItem[];
  totalEmployerContributions: number;
  metadata: Record<string, any>;
}

export interface LeaveRuleResult {
  annualVacationDays: number;
  seniorityBonusDays: number;
  totalEntitledDays: number;
  legalBasis: string;
}

export interface ICountryEngine {
  readonly countryCode: CountryCode;
  readonly countryName: string;
  readonly currency: string;

  // Vacation & Leaves
  calculateVacationDays(seniorityYears: number): LeaveRuleResult;
  calculateVacationBonus(baseSalary: number, vacationDays: number): number;
  getMandatoryLeaveTypes(): { type: LeaveType; label: string; defaultDays: number; isPaid: boolean }[];

  // Payroll & Deductions
  calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult;
  calculateStatutoryBonus(period: 'MID_YEAR' | 'YEAR_END', nominalSalary: number, monthsWorkedInPeriod: number): {
    bonusName: string;
    amount: number;
    description: string;
  };

  // Statutory Validation
  validateTaxId(taxId: string): { isValid: boolean; formatted: string; message?: string };
  getProbationMaxDays(): number;
}
