import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña es obligatoria')
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Email inválido')
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token es obligatorio'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual es obligatoria'),
  newPassword: z.string().min(8, 'La contraseña nueva debe tener al menos 8 caracteres')
});

export const EmployeeSchema = z.object({
  employee_code: z.string().optional(),
  first_name: z.string().min(1, 'Nombre es obligatorio'),
  last_name: z.string().min(1, 'Apellido es obligatorio'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  birth_date: z.string().optional(),
  national_id: z.string().optional(),
  tax_id: z.string().optional(),
  hire_date: z.string().optional(),
  employment_status: z.enum(['ACTIVE', 'PROBATION', 'SUSPENDED', 'TERMINATED']).default('ACTIVE'),
  contract_type: z.enum(['INDEFINITE', 'FIXED_TERM', 'PART_TIME', 'INTERNSHIP', 'CONTRACTOR']).default('INDEFINITE'),
  base_salary: z.number().positive('Salario base debe ser positivo').optional().default(50000),
  currency: z.string().default('USD'),
  company_id: z.string().optional(),
  branch_id: z.string().optional(),
  department_id: z.string().optional(),
  position_id: z.string().optional(),
  manager_id: z.string().optional()
});

export const EmployeeUpdateSchema = EmployeeSchema.partial().strict();

export const CompanySettingsSchema = z.object({
  companyName: z.string().min(1, 'Nombre de empresa es obligatorio'),
  domain: z.string().min(1, 'Dominio es obligatorio'),
  defaultCurrency: z.string().min(1, 'Moneda es obligatoria'),
  defaultCountry: z.string().length(2, 'País debe tener 2 caracteres'),
  timezone: z.string().min(1, 'Zona horaria es obligatoria')
});

export const WebhookSchema = z.object({
  name: z.string().min(1, 'Nombre es obligatorio'),
  url: z.string().url('URL inválida'),
  secret: z.string().min(1, 'Secreto es obligatorio'),
  events: z.array(z.string()).default([]),
  max_retries: z.number().int().positive().optional(),
  retry_backoff_base: z.number().int().positive().optional()
});

export const LeaveRequestSchema = z.object({
  leave_type: z.enum(['VACATION', 'MEDICAL', 'STUDY', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'UNPAID']),
  start_date: z.string().min(1, 'Fecha de inicio es obligatoria'),
  end_date: z.string().min(1, 'Fecha de fin es obligatoria'),
  reason: z.string().optional()
});

export const PayrollCalculationSchema = z.object({
  companyId: z.string().uuid('ID de compañía inválido'),
  periodName: z.string().optional(),
  periodType: z.enum(['MONTHLY', 'BIWEEKLY', 'MID_YEAR_BONUS', 'YEAR_END_BONUS']).optional(),
  countryCode: z.enum(['UY', 'AR', 'BR', 'US', 'GLOBAL']).optional()
});

export const RecruitmentCostSchema = z.object({
  category: z.string().min(1, 'Categoría es obligatoria'),
  description: z.string().min(1, 'Descripción es obligatoria'),
  amount: z.number().nonnegative('Monto debe ser positivo'),
  hired_count: z.number().int().nonnegative().optional(),
  currency: z.string().optional(),
  incurred_at: z.string().optional(),
  job_opening_id: z.string().optional()
});

export const CandidateStageSchema = z.object({
  stage: z.enum(['APPLIED', 'SCREENING', 'INTERVIEW', 'TECHNICAL_TEST', 'OFFER', 'HIRED', 'REJECTED'])
});

export const JobOpeningSchema = z.object({
  title: z.string().min(1, 'Título es obligatorio'),
  description: z.string().min(1, 'Descripción es obligatoria'),
  requirements: z.string().optional(),
  openings_count: z.coerce.number().int().positive().optional().default(1),
  department_id: z.string().optional().nullable(),
  position_id: z.string().optional().nullable(),
  company_id: z.string().optional().nullable()
});

export const CandidateCreateSchema = z.object({
  first_name: z.string().min(1, 'Nombre es obligatorio'),
  last_name: z.string().min(1, 'Apellido es obligatorio'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional().nullable(),
  job_opening_id: z.string().min(1, 'Vacante es obligatoria'),
  notes: z.string().optional().nullable(),
  rating: z.coerce.number().int().min(0).max(5).optional().default(0)
});

export const CandidateUpdateSchema = z.object({
  first_name: z.string().min(1, 'Nombre es obligatorio'),
  last_name: z.string().min(1, 'Apellido es obligatorio'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  rating: z.coerce.number().int().min(0).max(5).optional().default(0)
});

export const DocumentUploadSchema = z.object({
  employee_id: z.string().min(1, 'ID de empleado es obligatorio'),
  title: z.string().min(1, 'Título es obligatorio'),
  category: z.enum(['CONTRACT', 'ID_DOCUMENT', 'CERTIFICATE', 'PAYSLIP', 'POLICY', 'TAX_FORM', 'OTHER']),
  fileName: z.string().min(1, 'Nombre de archivo es obligatorio'),
  mimeType: z.string().min(1, 'Tipo MIME es obligatorio'),
  data: z.string().min(1, 'Datos del archivo son obligatorios'),
  expiry_date: z.string().optional(),
  is_confidential: z.boolean().optional()
});

export const AiQuerySchema = z.object({
  prompt: z.string().min(1, 'Prompt es obligatorio')
});

export const EngineSimulateSchema = z.object({
  countryCode: z.enum(['UY', 'AR', 'BR', 'US', 'GLOBAL']).optional(),
  baseSalary: z.number().positive().optional(),
  overtimeHours: z.number().nonnegative().optional(),
  seniorityYears: z.number().int().positive().optional()
});

export const MeritCycleSchema = z.object({
  employee_id: z.string().min(1, 'ID de empleado es obligatorio'),
  proposed_salary: z.number().positive('Salario propuesto debe ser positivo'),
  merit_score: z.number().min(0).max(100).optional().nullable(),
  performance_rating: z.string().optional().nullable(),
  effective_date: z.string().min(1, 'Fecha efectiva es obligatoria'),
  notes: z.string().optional().nullable()
});

export const EquityGrantSchema = z.object({
  employee_id: z.string().min(1, 'ID de empleado es obligatorio'),
  grant_type: z.string().min(1, 'Tipo de otorgamiento es obligatorio'),
  shares: z.number().int().positive('Cantidad de acciones debe ser positiva'),
  strike_price: z.number().nonnegative().optional().nullable(),
  vesting_years: z.number().int().positive('Años de vestimiento son obligatorios'),
  cliff_months: z.number().int().nonnegative().optional().default(12),
  notes: z.string().optional().nullable()
});

export const CVAnalyzeSchema = z.object({
  jobOpeningId: z.string().uuid('ID de vacante inválido'),
  cvText: z.string().min(50, 'Texto del CV muy corto'),
  candidateId: z.string().uuid().optional()
});

export const CVBatchAnalyzeSchema = z.object({
  jobOpeningId: z.string().uuid('ID de vacante inválido'),
  cvs: z.array(z.object({
    text: z.string().min(50),
    filename: z.string().min(1)
  })).min(1).max(50)
});

export const CVResultsQuerySchema = z.object({
  classification: z.enum(['elegible', 'descartado']).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0)
});
