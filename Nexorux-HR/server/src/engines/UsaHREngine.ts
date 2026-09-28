import { CountryCode, LeaveType } from '../domain/types';
import { ICountryEngine, LeaveRuleResult, PayrollCalculationInput, PayrollCalculationResult, TaxDeductionItem } from './BaseCountryEngine';

export class UsaHREngine implements ICountryEngine {
  readonly countryCode: CountryCode = 'US';
  readonly countryName = 'United States';
  readonly currency = 'USD';

  calculateVacationDays(seniorityYears: number): LeaveRuleResult {
    // Standard US Accrual: 10 base PTO days, +2 days per 3 years of tenure
    const baseDays = 10;
    const seniorityBonus = Math.min(10, Math.floor(seniorityYears / 3) * 2);
    return {
      annualVacationDays: baseDays,
      seniorityBonusDays: seniorityBonus,
      totalEntitledDays: baseDays + seniorityBonus,
      legalBasis: 'FLSA / Employer Standard Accrual Policy (10 base days + tenure progression)'
    };
  }

  calculateVacationBonus(_baseSalary: number, _vacationDays: number): number {
    return 0; // US PTO is typically regular paid time off without a statutory cash multiplier
  }

  getMandatoryLeaveTypes() {
    return [
      { type: 'VACATION' as LeaveType, label: 'Paid Time Off (PTO / Vacation)', defaultDays: 15, isPaid: true },
      { type: 'MEDICAL' as LeaveType, label: 'Sick Leave (State/Company Mandated)', defaultDays: 5, isPaid: true },
      { type: 'MATERNITY' as LeaveType, label: 'FMLA Family & Medical Leave (Unpaid protected)', defaultDays: 60, isPaid: false },
      { type: 'BEREAVEMENT' as LeaveType, label: 'Bereavement Leave', defaultDays: 3, isPaid: true },
      { type: 'UNPAID' as LeaveType, label: 'Unpaid Personal Leave', defaultDays: 0, isPaid: false },
    ];
  }

  calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
    const proratedBase = Math.round((input.baseSalary / input.totalDaysInMonth) * input.workedDays);
    const hourlyRate = input.baseSalary / 160;
    const overtimeRate = input.overtimePayRate || 1.5; // FLSA 1.5x after 40 hours
    const overtimeEarnings = Math.round(input.overtimeHours * hourlyRate * overtimeRate);
    const grossTotal = proratedBase + overtimeEarnings;

    // FICA Withholdings:
    // Social Security: 6.2%
    const socialSecurity = Math.round(grossTotal * 0.062);
    // Medicare: 1.45%
    const medicare = Math.round(grossTotal * 0.0145);
    // Federal Income Tax (W-4 estimated withholding ~12%)
    const federalTax = Math.round(grossTotal * 0.12);
    // State Income Tax (~4% estimated)
    const stateTax = Math.round(grossTotal * 0.04);

    const employeeDeductions: TaxDeductionItem[] = [
      { name: 'Social Security Employee Tax (6.2%)', code: 'US_FICA_SS', rate: 0.062, amount: socialSecurity, type: 'EMPLOYEE' },
      { name: 'Medicare Employee Tax (1.45%)', code: 'US_FICA_MED', rate: 0.0145, amount: medicare, type: 'EMPLOYEE' },
      { name: 'Federal Income Tax Withholding (Form W-4)', code: 'US_FIT', rate: 0.12, amount: federalTax, type: 'EMPLOYEE' },
      { name: 'State Income Tax Withholding (SIT)', code: 'US_SIT', rate: 0.04, amount: stateTax, type: 'EMPLOYEE' }
    ];

    const totalEmployeeDeductions = socialSecurity + medicare + federalTax + stateTax;
    const netSalary = grossTotal - totalEmployeeDeductions;

    // Employer Matching
    const employerSS = socialSecurity;
    const employerMed = medicare;
    const futaSuta = Math.round(grossTotal * 0.02); // FUTA + SUTA estimate

    const employerContributions: TaxDeductionItem[] = [
      { name: 'Employer Social Security Match (6.2%)', code: 'US_ER_SS', rate: 0.062, amount: employerSS, type: 'EMPLOYER' },
      { name: 'Employer Medicare Match (1.45%)', code: 'US_ER_MED', rate: 0.0145, amount: employerMed, type: 'EMPLOYER' },
      { name: 'Federal & State Unemployment (FUTA/SUTA)', code: 'US_FUTA', rate: 0.02, amount: futaSuta, type: 'EMPLOYER' }
    ];

    return {
      countryCode: this.countryCode,
      grossSalary: proratedBase,
      overtimeEarnings,
      statutoryBonus: 0,
      totalGross: grossTotal,
      employeeDeductions,
      totalEmployeeDeductions,
      netSalary,
      employerContributions,
      totalEmployerContributions: employerSS + employerMed + futaSuta,
      metadata: {
        legalFramework: 'Fair Labor Standards Act (FLSA) / IRS Circular E',
        complianceForm: 'Form W-2 / Form 941'
      }
    };
  }

  calculateStatutoryBonus(_period: 'MID_YEAR' | 'YEAR_END', _nominalSalary: number, _monthsWorkedInPeriod: number) {
    return {
      bonusName: 'Discretionary / Performance Bonus',
      amount: 0,
      description: 'Under US Labor Law (FLSA), year-end and statutory bonuses are discretionary unless defined in employment agreement.'
    };
  }

  validateTaxId(taxId: string) {
    // SSN (9 digits: XXX-XX-XXXX) or EIN (XX-XXXXXXX)
    const cleaned = taxId.replace(/\D/g, '');
    if (cleaned.length === 9) {
      return { isValid: true, formatted: `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}` };
    }
    return { isValid: false, formatted: taxId, message: 'US SSN or EIN must be 9 digits' };
  }

  getProbationMaxDays(): number {
    return 90; // Typical 90-day introductory period in US employment agreements
  }
}
