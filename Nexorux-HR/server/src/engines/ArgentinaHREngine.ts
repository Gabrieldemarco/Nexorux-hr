import { CountryCode, LeaveType } from '../domain/types';
import { ICountryEngine, LeaveRuleResult, PayrollCalculationInput, PayrollCalculationResult, TaxDeductionItem } from './BaseCountryEngine';

export class ArgentinaHREngine implements ICountryEngine {
  readonly countryCode: CountryCode = 'AR';
  readonly countryName = 'Argentina';
  readonly currency = 'ARS';

  calculateVacationDays(seniorityYears: number): LeaveRuleResult {
    // Ley de Contrato de Trabajo (LCT) Ley 20.744 Art. 150
    let days = 14;
    if (seniorityYears >= 20) {
      days = 35;
    } else if (seniorityYears >= 10) {
      days = 28;
    } else if (seniorityYears >= 5) {
      days = 21;
    }
    return {
      annualVacationDays: days,
      seniorityBonusDays: days - 14,
      totalEntitledDays: days,
      legalBasis: 'Ley 20.744 Art. 150 (LCT Argentina: 14, 21, 28 o 35 días corridos según antigüedad)'
    };
  }

  calculateVacationBonus(baseSalary: number, vacationDays: number): number {
    // Plus vacacional LCT: El valor día de vacaciones se calcula dividiendo por 25 en vez de 30
    const vacationDayRate = baseSalary / 25;
    const regularDayRate = baseSalary / 30;
    const plusVacacional = (vacationDayRate - regularDayRate) * vacationDays;
    return Math.round(plusVacacional * 100) / 100;
  }

  getMandatoryLeaveTypes() {
    return [
      { type: 'VACATION' as LeaveType, label: 'Vacaciones Ordinarias LCT', defaultDays: 14, isPaid: true },
      { type: 'MEDICAL' as LeaveType, label: 'Enfermedad Inculpable (Art. 208 LCT)', defaultDays: 90, isPaid: true },
      { type: 'STUDY' as LeaveType, label: 'Exámenes Secundarios o Universitarios (2 días/examen, máx 10)', defaultDays: 10, isPaid: true },
      { type: 'MATERNITY' as LeaveType, label: 'Maternidad (45 días antes y 45 después)', defaultDays: 90, isPaid: true },
      { type: 'PATERNITY' as LeaveType, label: 'Nacimiento de Hijo (Art. 158 LCT)', defaultDays: 2, isPaid: true },
      { type: 'BEREAVEMENT' as LeaveType, label: 'Fallecimiento Familiar Directo', defaultDays: 3, isPaid: true },
      { type: 'UNPAID' as LeaveType, label: 'Licencia sin goce de haberes', defaultDays: 0, isPaid: false },
    ];
  }

  calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
    const proratedBase = Math.round((input.baseSalary / input.totalDaysInMonth) * input.workedDays);
    const hourlyRate = input.baseSalary / 200;
    const overtimeRate = input.overtimePayRate || 1.5; // 50% días hábiles
    const overtimeEarnings = Math.round(input.overtimeHours * hourlyRate * overtimeRate);
    const grossTotal = proratedBase + overtimeEarnings;

    // Deducciones de Ley Empleado (17% Total base)
    // 1. SIPA Jubilación (11%)
    const jubilacion = Math.round(grossTotal * 0.11);
    // 2. INSSJP Ley 19.032 (3%)
    const inssjp = Math.round(grossTotal * 0.03);
    // 3. Obra Social Ley 23.660 (3%)
    const obraSocial = Math.round(grossTotal * 0.03);
    // 4. Impuesto a las Ganancias (4ta categoría estimado)
    let ganancias = 0;
    if (grossTotal > 1800000) { // Piso referencial aproximado
      ganancias = Math.round((grossTotal - 1800000) * 0.15);
    }

    const employeeDeductions: TaxDeductionItem[] = [
      { name: 'SIPA Aporte Jubilatorio (11%)', code: 'AR_SIPA', rate: 0.11, amount: jubilacion, type: 'EMPLOYEE' },
      { name: 'INSSJP Ley 19.032 (3%)', code: 'AR_INSSJP', rate: 0.03, amount: inssjp, type: 'EMPLOYEE' },
      { name: 'Obra Social Aporte (3%)', code: 'AR_OBRA_SOC', rate: 0.03, amount: obraSocial, type: 'EMPLOYEE' },
      { name: 'Retención Ganancias 4ª Categoría', code: 'AR_GANANCIAS', rate: grossTotal > 1800000 ? 0.15 : 0, amount: ganancias, type: 'EMPLOYEE' }
    ];

    const totalEmployeeDeductions = jubilacion + inssjp + obraSocial + ganancias;
    const netSalary = grossTotal - totalEmployeeDeductions;

    // Contribuciones Patronales (~24% F.931 AFIP)
    const contribucionesPatronales = Math.round(grossTotal * 0.24);
    const art = Math.round(grossTotal * 0.025); // ART estimada 2.5%

    const employerContributions: TaxDeductionItem[] = [
      { name: 'Contribuciones Seguridad Social F.931 (24%)', code: 'AR_F931', rate: 0.24, amount: contribucionesPatronales, type: 'EMPLOYER' },
      { name: 'Seguro de Riesgos de Trabajo (ART 2.5%)', code: 'AR_ART', rate: 0.025, amount: art, type: 'EMPLOYER' }
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
      totalEmployerContributions: contribucionesPatronales + art,
      metadata: {
        legalFramework: 'Ley de Contrato de Trabajo N° 20.744 (LCT Argentina)',
        afipForm: 'F.931 Libro Especial Art. 52'
      }
    };
  }

  calculateStatutoryBonus(period: 'MID_YEAR' | 'YEAR_END', nominalSalary: number, monthsWorkedInPeriod: number) {
    // Sueldo Anual Complementario (SAC) Art. 121 y 122 LCT
    // 50% de la mayor remuneración mensual devengada en el semestre
    const bonusName = period === 'MID_YEAR' ? 'S.A.C. 1ª Cuota (Junio)' : 'S.A.C. 2ª Cuota (Diciembre)';
    const amount = Math.round((nominalSalary * 0.5 * (monthsWorkedInPeriod / 6)));
    return {
      bonusName,
      amount,
      description: `Ley 20.744 Art. 121-122. 50% de la mayor remuneración mensual devengada, prorrateado por ${monthsWorkedInPeriod} meses.`
    };
  }

  validateTaxId(taxId: string) {
    // CUIT/CUIL Argentino (11 dígitos, ej: 20-12345678-9)
    const cleaned = taxId.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return { isValid: true, formatted: `${cleaned.slice(0, 2)}-${cleaned.slice(2, 10)}-${cleaned.slice(10)}` };
    }
    return { isValid: false, formatted: taxId, message: 'CUIT/CUIL debe contener 11 dígitos' };
  }

  getProbationMaxDays(): number {
    return 90; // Período de prueba LCT Art. 92 bis (3 meses)
  }
}
