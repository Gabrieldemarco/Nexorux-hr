export type UserRole = 
  | 'SUPER_ADMIN'
  | 'TENANT_OWNER'
  | 'HR_ADMIN'
  | 'HR_MANAGER'
  | 'MANAGER'
  | 'RECRUITER'
  | 'PAYROLL_MANAGER'
  | 'EMPLOYEE';

export type EmploymentStatus = 'ACTIVE' | 'PROBATION' | 'SUSPENDED' | 'TERMINATED';

export type ContractType = 'INDEFINITE' | 'FIXED_TERM' | 'PART_TIME' | 'INTERNSHIP' | 'CONTRACTOR';

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE' | 'HOLIDAY';

export type LeaveType = 'VACATION' | 'MEDICAL' | 'STUDY' | 'MATERNITY' | 'PATERNITY' | 'BEREAVEMENT' | 'UNPAID';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type CandidateStage = 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'TECHNICAL_TEST' | 'OFFER' | 'HIRED' | 'REJECTED';

export type DocumentCategory = 'CONTRACT' | 'ID_DOCUMENT' | 'CERTIFICATE' | 'PAYSLIP' | 'POLICY' | 'TAX_FORM' | 'OTHER';

export type CountryCode = 'UY' | 'AR' | 'BR' | 'US' | 'GLOBAL';

export interface Tenant {
  id: string;
  slug: string;
  legal_name: string;
  country_code: CountryCode;
  currency: string;
  timezone: string;
  is_active: number;
  branding_json?: string;
  created_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  employee_id?: string;
  status: 'ACTIVE' | 'INACTIVE';
  last_login_at?: string;
  created_at: string;
}

export interface Company {
  id: string;
  tenant_id: string;
  name: string;
  tax_id: string;
  country_code: CountryCode;
  legal_address: string;
  is_headquarters: number;
  created_at: string;
}

export interface Branch {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  city: string;
  address: string;
  timezone: string;
}

export interface Department {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  code: string;
  parent_id?: string;
}

export interface Position {
  id: string;
  tenant_id: string;
  title: string;
  department_id: string;
  level: string; // e.g., 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'
  min_salary: number;
  max_salary: number;
  description: string;
}

export interface Employee {
  id: string;
  tenant_id: string;
  company_id: string;
  branch_id: string;
  department_id: string;
  position_id: string;
  manager_id?: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  birth_date: string;
  national_id: string;
  tax_id: string;
  hire_date: string;
  employment_status: EmploymentStatus;
  contract_type: ContractType;
  base_salary: number;
  currency: string;
  photo_url?: string;
  emergency_contact_json?: string;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  tenant_id: string;
  employee_id: string;
  contract_number: string;
  type: ContractType;
  start_date: string;
  end_date?: string;
  probation_end_date?: string;
  base_salary: number;
  currency: string;
  work_hours_per_week: number;
  status: 'ACTIVE' | 'EXPIRED' | 'RENEWED' | 'TERMINATED';
}

export interface SalaryHistory {
  id: string;
  tenant_id: string;
  employee_id: string;
  effective_date: string;
  previous_salary: number;
  new_salary: number;
  currency: string;
  reason: string;
  approved_by_user_id?: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  tenant_id: string;
  employee_id: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  break_minutes: number;
  regular_hours: number;
  overtime_hours: number;
  status: AttendanceStatus;
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  status: LeaveStatus;
  reason?: string;
  approver_id?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface LeaveBalance {
  id: string;
  tenant_id: string;
  employee_id: string;
  year: number;
  allocated_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
}

export interface PayrollRun {
  id: string;
  tenant_id: string;
  company_id: string;
  period_name: string; // e.g. "Junio 2026", "SAC 1ra Cuota 2026"
  period_type: 'MONTHLY' | 'BIWEEKLY' | 'MID_YEAR_BONUS' | 'YEAR_END_BONUS';
  start_date: string;
  end_date: string;
  country_code: CountryCode;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  total_employer_contributions: number;
  status: 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'PAID';
  processed_at?: string;
  created_at: string;
}

export interface PayrollSlip {
  id: string;
  tenant_id: string;
  payroll_run_id: string;
  employee_id: string;
  base_salary: number;
  gross_earnings: number;
  statutory_bonus: number; // Aguinaldo, SAC, 13º
  overtime_pay: number;
  deductions: number;
  net_pay: number;
  employer_taxes: number;
  breakdown_json: string; // Itemized calculations
}

export interface JobOpening {
  id: string;
  tenant_id: string;
  company_id: string;
  department_id: string;
  position_id: string;
  title: string;
  description: string;
  requirements: string;
  openings_count: number;
  status: 'OPEN' | 'PAUSED' | 'CLOSED';
  created_at: string;
}

export interface Candidate {
  id: string;
  tenant_id: string;
  job_opening_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  current_stage: CandidateStage;
  cv_url?: string;
  rating: number;
  notes?: string;
  applied_date: string;
}

export interface OnboardingTask {
  id: string;
  tenant_id: string;
  employee_id: string;
  title: string;
  description: string;
  category: 'DOCUMENTATION' | 'IT_SETUP' | 'TRAINING' | 'MEETING' | 'EQUIPMENT';
  assigned_to_user_id?: string;
  due_date: string;
  is_completed: number;
  completed_at?: string;
}

export interface EmployeeDocument {
  id: string;
  tenant_id: string;
  employee_id: string;
  title: string;
  category: DocumentCategory;
  file_url: string;
  file_size_bytes: number;
  mime_type: string;
  expiry_date?: string;
  is_confidential: number;
  uploaded_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  user_email?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details_json: string;
  ip_address: string;
  created_at: string;
}

export interface Webhook {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  secret: string;
  events: string;
  is_active: number;
  max_retries: number;
  retry_backoff_base: number;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  tenant_id: string;
  event_type: string;
  payload_json: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'DISABLED' | 'PROCESSING';
  http_status: number | null;
  response_body: string | null;
  attempt_count: number;
  next_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

// RBAC Permissions
export type Permission =
  | 'tenant.manage'
  | 'employee.view_all'
  | 'employee.view_team'
  | 'employee.view_self'
  | 'employee.create'
  | 'employee.update'
  | 'employee.delete'
  | 'salary.view'
  | 'salary.update'
  | 'org.manage'
  | 'attendance.manage'
  | 'attendance.clock'
  | 'leave.approve'
  | 'leave.request'
  | 'payroll.view'
  | 'payroll.run'
  | 'payroll.approve'
  | 'recruitment.manage'
  | 'document.view_all'
  | 'document.upload'
  | 'document.delete'
  | 'reports.view'
  | 'audit.view'
  | 'ai.use';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'tenant.manage', 'employee.view_all', 'employee.create', 'employee.update', 'employee.delete',
    'salary.view', 'salary.update', 'org.manage', 'attendance.manage', 'attendance.clock',
    'leave.approve', 'leave.request', 'payroll.view', 'payroll.run', 'payroll.approve',
    'recruitment.manage', 'document.view_all', 'document.upload', 'document.delete',
    'reports.view', 'audit.view', 'ai.use'
  ],
  TENANT_OWNER: [
    'tenant.manage', 'employee.view_all', 'employee.create', 'employee.update', 'employee.delete',
    'salary.view', 'salary.update', 'org.manage', 'attendance.manage', 'attendance.clock',
    'leave.approve', 'leave.request', 'payroll.view', 'payroll.run', 'payroll.approve',
    'recruitment.manage', 'document.view_all', 'document.upload', 'document.delete',
    'reports.view', 'audit.view', 'ai.use'
  ],
  HR_ADMIN: [
    'tenant.manage', 'employee.view_all', 'employee.create', 'employee.update', 'employee.delete',
    'salary.view', 'salary.update', 'org.manage', 'attendance.manage', 'attendance.clock',
    'leave.approve', 'leave.request', 'payroll.view', 'payroll.run', 'payroll.approve',
    'recruitment.manage', 'document.view_all', 'document.upload', 'document.delete',
    'reports.view', 'audit.view', 'ai.use'
  ],
  HR_MANAGER: [
    'employee.view_all', 'employee.create', 'employee.update',
    'salary.view', 'org.manage', 'attendance.manage', 'attendance.clock',
    'leave.approve', 'leave.request', 'payroll.view',
    'recruitment.manage', 'document.view_all', 'document.upload',
    'reports.view', 'ai.use'
  ],
  MANAGER: [
    'employee.view_team', 'attendance.manage', 'attendance.clock',
    'leave.approve', 'leave.request', 'reports.view', 'ai.use'
  ],
  RECRUITER: [
    'recruitment.manage', 'employee.view_all', 'document.upload', 'ai.use'
  ],
  PAYROLL_MANAGER: [
    'employee.view_all', 'salary.view', 'salary.update', 'payroll.view', 'payroll.run',
    'payroll.approve', 'reports.view', 'ai.use'
  ],
  EMPLOYEE: [
    'employee.view_self', 'attendance.clock', 'leave.request', 'ai.use'
  ]
};
