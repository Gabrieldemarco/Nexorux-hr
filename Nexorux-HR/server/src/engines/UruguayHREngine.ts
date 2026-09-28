import { CountryCode, LeaveType } from '../domain/types';
import { ICountryEngine, LeaveRuleResult, PayrollCalculationInput, PayrollCalculationResult, TaxDeductionItem } from './BaseCountryEngine';

export class UruguayHREngine implements ICountryEngine {
  readonly countryCode: CountryCode = 'UY';
  readonly countryName = 'Uruguay';
  readonly currency = 'UYU';

  calculateVacationDays(seniorityYears: number): LeaveRuleResult {
    // Uruguay: Ley 12.590. Base de 20 días. Al 5to año cumplido, 1 día extra cada 4 años.
    const baseDays = 20;
    let seniorityBonus = 0;
    if (seniorityYears >= 5) {
      seniorityBonus = Math.floor((seniorityYears - 4) / 4) + 1;
    }
    return {
      annualVacationDays: baseDays,
      seniorityBonusDays: seniorityBonus,
      totalEntitledDays: baseDays + seniorityBonus,
      legalBasis: 'Ley 12.590 y Dec. 26/04/1962 (20 días base + 1 día cada 4 años a partir del 5º año)'
    };
  }

  calculateVacationBonus(baseSalary: number, vacationDays: number): number {
    // Salario Vacacional UY: líquido legal equivalente a los días de licencia (valor día = sueldo / 30)
    // Sin deducciones de aportes jubilatorios según Ley 16.101
    const dailyRate = baseSalary / 30;
    return Math.round(dailyRate * vacationDays * 100) / 100;
  }

  getMandatoryLeaveTypes() {
    return [
      { type: 'VACATION' as LeaveType, label: 'Licencia Anual Reglamentaria', defaultDays: 20, isPaid: true },
      { type: 'MEDICAL' as LeaveType, label: 'Licencia por Enfermedad (BPS / Certificación)', defaultDays: 3, isPaid: true },
      { type: 'STUDY' as LeaveType, label: 'Licencia por Estudio (Ley 18.345)', defaultDays: 12, isPaid: true },
      { type: 'MATERNITY' as LeaveType, label: 'Maternidad (Ley 19.161 - 14 semanas)', defaultDays: 98, isPaid: true },
      { type: 'PATERNITY' as LeaveType, label: 'Paternidad (Ley 19.161 - 10 a 13 días continuos)', defaultDays: 13, isPaid: true },
      { type: 'BEREAVEMENT' as LeaveType, label: 'Duelo Familiar (Ley 18.345)', defaultDays: 3, isPaid: true },
      { type: 'UNPAID' as LeaveType, label: 'Licencia Extraordinaria sin goce de sueldo', defaultDays: 0, isPaid: false },
    ];
  }

  calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
    const proratedBase = Math.round((input.baseSalary / input.totalDaysInMonth) * input.workedDays);
    const hourlyRate = input.baseSalary / (input.regularHours > 0 ? input.regularHours * 4.33 : 173.2);
    const overtimeRate = input.overtimePayRate || 2.0; // UY Ley 15.996: horas extra hábiles son 2x
    const overtimeEarnings = Math.round(input.overtimeHours * hourlyRate * overtimeRate);
    const grossTotal = proratedBase + overtimeEarnings;

    // Deducciones del Empleado
    // 1. Montepío Jubilatorio BPS: 15%
    const montepio = Math.round(grossTotal * 0.15);

    // 2. FONASA: entre 3% y 8% según hijos y cónyuge. Típico: 4.5% o 6%
    const fonasaRate = (input.dependentsCount && input.dependentsCount > 0) ? 0.06 : 0.045;
    const fonasa = Math.round(grossTotal * fonasaRate);

    // 3. FRL (Fondo de Reconversión Laboral): 0.1%
    const frl = Math.round(grossTotal * 0.001);

    // 4. IRPF Categoría II (Franjas simplificadas para BPC ~ 6,177 UYU)
    // Exento hasta ~7 BPC (~43,000 UYU)
    let irpf = 0;
    if (grossTotal > 43000) {
      irpf = Math.round((grossTotal - 43000) * 0.10); // Tramo promedio ponderado 10-15%
    }

    const employeeDeductions: TaxDeductionItem[] = [
      { name: 'BPS Montepío Jubilatorio (15%)', code: 'UY_BPS_JUB', rate: 0.15, amount: montepio, type: 'EMPLOYEE' },
      { name: `FONASA Seguro de Salud (${(fonasaRate * 100).toFixed(1)}%)`, code: 'UY_FONASA', rate: fonasaRate, amount: fonasa, type: 'EMPLOYEE' },
      { name: 'FRL Fondo Reconversión Laboral (0.1%)', code: 'UY_FRL', rate: 0.001, amount: frl, type: 'EMPLOYEE' },
      { name: 'IRPF Cat. II Retención Salarial', code: 'UY_IRPF', rate: grossTotal > 43000 ? 0.10 : 0, amount: irpf, type: 'EMPLOYEE' }
    ];

    const totalEmployeeDeductions = montepio + fonasa + frl + irpf;
    const netSalary = grossTotal - totalEmployeeDeductions;

    // Aportes Patronales UY
    const bpsPatronal = Math.round(grossTotal * 0.075); // 7.5%
    const fonasaPatronal = Math.round(grossTotal * 0.05); // 5%
    const frlPatronal = Math.round(grossTotal * 0.001); // 0.1%

    const employerContributions: TaxDeductionItem[] = [
      { name: 'BPS Aporte Patronal Jubilatorio (7.5%)', code: 'UY_BPS_PAT', rate: 0.075, amount: bpsPatronal, type: 'EMPLOYER' },
      { name: 'FONASA Aporte Patronal (5.0%)', code: 'UY_FONASA_PAT', rate: 0.05, amount: fonasaPatronal, type: 'EMPLOYER' },
      { name: 'FRL Aporte Patronal (0.1%)', code: 'UY_FRL_PAT', rate: 0.001, amount: frlPatronal, type: 'EMPLOYER' }
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
      totalEmployerContributions: bpsPatronal + fonasaPatronal + frlPatronal,
      metadata: {
        legalFramework: 'BPS / MTSS Uruguay',
        planillatrabajoRef: 'Decreto 108/007'
      }
    };
  }

  calculateStatutoryBonus(period: 'MID_YEAR' | 'YEAR_END', nominalSalary: number, monthsWorkedInPeriod: number) {
    // Aguinaldo Ley 12.840 (Junio: Diciembre a Mayo; Diciembre: Junio a Noviembre)
    // 1/12 de lo nominal generado en el semestre
    const bonusName = period === 'MID_YEAR' ? 'Aguinaldo (1ª Fracción Junio)' : 'Aguinaldo (2ª Fracción Diciembre)';
    const amount = Math.round((nominalSalary * monthsWorkedInPeriod) / 12);
    return {
      bonusName,
      amount,
      description: `Ley 12.840 y Decreto-Ley 14.525. 1/12 de lo percibido en el semestre (${monthsWorkedInPeriod} meses computados).`
    };
  }

  validateTaxId(taxId: string) {
    // Cédula de Identidad Uruguaya o RUT (12 dígitos)
    const cleaned = taxId.replace(/\D/g, '');
    if (cleaned.length === 8 || cleaned.length === 7 || cleaned.length === 12) {
      return { isValid: true, formatted: cleaned };
    }
    return { isValid: false, formatted: taxId, message: 'Formato de CI o RUT uruguayo inválido' };
  }

  getProbationMaxDays(): number {
    return 90; // Plazo habitual de período de prueba en UY (3 meses)
  }
}
