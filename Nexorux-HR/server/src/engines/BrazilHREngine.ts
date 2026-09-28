import { CountryCode, LeaveType } from '../domain/types';
import { ICountryEngine, LeaveRuleResult, PayrollCalculationInput, PayrollCalculationResult, TaxDeductionItem } from './BaseCountryEngine';

export class BrazilHREngine implements ICountryEngine {
  readonly countryCode: CountryCode = 'BR';
  readonly countryName = 'Brazil';
  readonly currency = 'BRL';

  calculateVacationDays(seniorityYears: number): LeaveRuleResult {
    // CLT Art. 130: 30 dias corridos após cada período aquisitivo de 12 meses
    return {
      annualVacationDays: 30,
      seniorityBonusDays: 0,
      totalEntitledDays: 30,
      legalBasis: 'Consolidação das Leis do Trabalho (CLT) Art. 129 e 130 (30 dias corridos)'
    };
  }

  calculateVacationBonus(baseSalary: number, vacationDays: number): number {
    // 1/3 Constitucional (Art. 7º, XVII da CF/88)
    const vacationProportion = (baseSalary / 30) * vacationDays;
    const thirdBonus = vacationProportion / 3;
    return Math.round(thirdBonus * 100) / 100;
  }

  getMandatoryLeaveTypes() {
    return [
      { type: 'VACATION' as LeaveType, label: 'Férias Regulamentares CLT (+ 1/3)', defaultDays: 30, isPaid: true },
      { type: 'MEDICAL' as LeaveType, label: 'Auxílio-Doença (Primeiros 15 dias pela empresa)', defaultDays: 15, isPaid: true },
      { type: 'STUDY' as LeaveType, label: 'Exames Vestibulares (Art. 473 CLT)', defaultDays: 2, isPaid: true },
      { type: 'MATERNITY' as LeaveType, label: 'Licença Maternidade (120 a 180 dias)', defaultDays: 120, isPaid: true },
      { type: 'PATERNITY' as LeaveType, label: 'Licença Paternidade (5 a 20 dias Empresa Cidadã)', defaultDays: 5, isPaid: true },
      { type: 'BEREAVEMENT' as LeaveType, label: 'Gala / Luto (Art. 473 CLT)', defaultDays: 2, isPaid: true },
      { type: 'UNPAID' as LeaveType, label: 'Licença não remunerada', defaultDays: 0, isPaid: false },
    ];
  }

  calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
    const proratedBase = Math.round((input.baseSalary / input.totalDaysInMonth) * input.workedDays);
    const hourlyRate = input.baseSalary / 220;
    const overtimeRate = input.overtimePayRate || 1.5; // 50% mínimo
    const overtimeEarnings = Math.round(input.overtimeHours * hourlyRate * overtimeRate);
    const grossTotal = proratedBase + overtimeEarnings;

    // Descontos do Empregado
    // 1. INSS Progressivo (Tabela simplificada média ~9% - 11%)
    let inss = 0;
    if (grossTotal <= 1412) {
      inss = Math.round(grossTotal * 0.075);
    } else if (grossTotal <= 2666) {
      inss = Math.round(grossTotal * 0.09);
    } else if (grossTotal <= 4000) {
      inss = Math.round(grossTotal * 0.12);
    } else {
      inss = Math.round(Math.min(grossTotal, 7786) * 0.14);
    }

    // 2. IRRF Progressivo
    let irrf = 0;
    const taxableAfterInss = grossTotal - inss;
    if (taxableAfterInss > 2826) {
      irrf = Math.round((taxableAfterInss - 2826) * 0.15);
    }

    const employeeDeductions: TaxDeductionItem[] = [
      { name: 'INSS Previdência Social', code: 'BR_INSS', rate: inss / grossTotal, amount: inss, type: 'EMPLOYEE' },
      { name: 'IRRF Imposto de Renda Retido na Fonte', code: 'BR_IRRF', rate: irrf > 0 ? 0.15 : 0, amount: irrf, type: 'EMPLOYEE' }
    ];

    const totalEmployeeDeductions = inss + irrf;
    const netSalary = grossTotal - totalEmployeeDeductions;

    // Encargos Patronais
    // FGTS (8%) - pago pela empresa
    const fgts = Math.round(grossTotal * 0.08);
    // INSS Patronal / RAT / Sistema S (~20% + 5.8%)
    const inssPatronal = Math.round(grossTotal * 0.258);

    const employerContributions: TaxDeductionItem[] = [
      { name: 'FGTS Fundo de Garantia (8.0%)', code: 'BR_FGTS', rate: 0.08, amount: fgts, type: 'EMPLOYER' },
      { name: 'INSS Patronal + Outras Entidades (25.8%)', code: 'BR_INSS_PAT', rate: 0.258, amount: inssPatronal, type: 'EMPLOYER' }
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
      totalEmployerContributions: fgts + inssPatronal,
      metadata: {
        legalFramework: 'Consolidação das Leis do Trabalho (CLT) / eSocial',
        cnae: '6201-5/01'
      }
    };
  }

  calculateStatutoryBonus(period: 'MID_YEAR' | 'YEAR_END', nominalSalary: number, monthsWorkedInPeriod: number) {
    // 13º Salário (Lei 4.090/1962 e Lei 4.749/1965)
    // 1ª parcela paga até 30 de novembro (50% sem desconto)
    // 2ª parcela paga até 20 de dezembro (com descontos)
    const bonusName = period === 'MID_YEAR' ? '13º Salário - 1ª Parcela (Adiantamento)' : '13º Salário - 2ª Parcela (Quitação)';
    const amount = Math.round((nominalSalary / 12) * monthsWorkedInPeriod * (period === 'MID_YEAR' ? 0.5 : 0.5));
    return {
      bonusName,
      amount,
      description: `Lei 4.090/1962. 1/12 por fração igual ou superior a 15 dias de trabalho (${monthsWorkedInPeriod} meses computados).`
    };
  }

  validateTaxId(taxId: string) {
    // CPF (11 dígitos) ou CNPJ (14 dígitos)
    const cleaned = taxId.replace(/\D/g, '');
    if (cleaned.length === 11 || cleaned.length === 14) {
      return { isValid: true, formatted: cleaned };
    }
    return { isValid: false, formatted: taxId, message: 'CPF ou CNPJ inválido' };
  }

  getProbationMaxDays(): number {
    return 90; // CLT Art. 445: Contrato de experiência até 90 dias
  }
}
