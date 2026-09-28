/**
 * Database schema types for Kysely
 * Generated from existing SQLite schema - single source of truth
 */

export interface Tenant {
  id: string;
  slug: string;
  legal_name: string;
  country_code: string;
  currency: string;
  timezone: string;
  is_active: number;
  branding_json: string | null;
  allowed_origins: string | null;
  created_at: string;
}

export interface Company {
  id: string;
  tenant_id: string;
  name: string;
  tax_id: string;
  country_code: string;
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
  parent_id: string | null;
}

export interface Position {
  id: string;
  tenant_id: string;
  title: string;
  department_id: string;
  level: string;
  min_salary: number;
  max_salary: number;
  description: string | null;
}

export interface Employee {
  id: string;
  tenant_id: string;
  company_id: string;
  branch_id: string;
  department_id: string;
  position_id: string;
  manager_id: string | null;
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
  employment_status: string;
  contract_type: string;
  base_salary: number;
  currency: string;
  photo_url: string | null;
  emergency_contact_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  tenant_id: string;
  employee_id: string;
  contract_number: string;
  type: string;
  start_date: string;
  end_date: string | null;
  probation_end_date: string | null;
  base_salary: number;
  currency: string;
  work_hours_per_week: number;
  status: string;
}

export interface LeaveRequest {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: string;
  reason: string | null;
  approver_id: string | null;
  rejection_reason: string | null;
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

export interface CompensationMeritCycle {
  id: string;
  tenant_id: string;
  employee_id: string;
  proposed_salary: number;
  merit_score: number | null;
  performance_rating: string | null;
  effective_date: string;
  status: string;
  notes: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface EquityGrant {
  id: string;
  tenant_id: string;
  employee_id: string;
  grant_type: string;
  shares: number;
  strike_price: number | null;
  vesting_years: number;
  cliff_months: number;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PayrollRun {
  id: string;
  tenant_id: string;
  company_id: string;
  period_name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  country_code: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  total_employer_contributions: number;
  status: string;
  processed_at: string | null;
  created_at: string;
}

export interface PayrollSlip {
  id: string;
  tenant_id: string;
  payroll_run_id: string;
  employee_id: string;
  base_salary: number;
  gross_earnings: number;
  statutory_bonus: number;
  overtime_pay: number;
  deductions: number;
  net_pay: number;
  employer_taxes: number;
  breakdown_json: string;
}

export interface JobOpening {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  requirements: string | null;
  openings_count: number;
  status: string;
  company_id: string | null;
  department_id: string | null;
  position_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Candidate {
  id: string;
  tenant_id: string;
  job_opening_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  current_stage: string;
  cv_url: string | null;
  rating: number;
  notes: string | null;
  applied_date: string;
  created_by: string | null;
  hired_employee_id: string | null;
}

export interface RecruitmentCost {
  id: string;
  tenant_id: string;
  job_opening_id: string | null;
  category: string;
  description: string;
  amount: number;
  hired_count: number;
  currency: string;
  incurred_at: string;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  tenant_id: string;
  event_key: string;
  email: number;
  slack: number;
  push: number;
  updated_at: string;
}

export interface ApiIntegration {
  id: string;
  tenant_id: string;
  provider: string;
  category: string;
  description: string;
  status: string;
  config_json: string | null;
  updated_at: string;
}

export interface TenantApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  revoked_at: string | null;
  last_used_at: string | null;
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
  status: string;
  http_status: number | null;
  response_body: string | null;
  attempt_count: number;
  next_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  employee_id: string | null;
  status: string;
  last_login_at: string | null;
  created_at: string;
}

export interface PasswordResetToken {
  id: string;
  tenant_id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface OnboardingTask {
  id: string;
  tenant_id: string;
  employee_id: string;
  title: string;
  description: string;
  category: string;
  due_date: string;
  is_completed: number;
  completed_at: string | null;
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
  approved_by_user_id: string | null;
  created_at: string;
}

export interface EmployeeDocument {
  id: string;
  tenant_id: string;
  employee_id: string;
  title: string;
  category: string;
  file_url: string;
  file_size_bytes: number;
  mime_type: string;
  expiry_date: string | null;
  is_confidential: number;
  uploaded_at: string;
}

export interface Attendance {
  id: string;
  tenant_id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  regular_hours: number;
  overtime_hours: number;
  status: string;
  notes: string | null;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string;
  user_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details_json: string;
  ip_address: string;
  created_at: string;
}

export interface CVAnalysis {
  id: string;
  tenant_id: string;
  job_opening_id: string;
  candidate_id: string | null;
  candidate_name: string;
  candidate_email: string;
  match_score: number;
  classification: string;
  strengths_json: string;
  gaps_json: string;
  missing_requirements_json: string;
  created_at: string;
}

export interface SchemaMigrations {
  version: string;
  applied_at: string;
}

/**
 * Complete database interface for Kysely
 */
export interface Database {
  tenants: Tenant;
  companies: Company;
  branches: Branch;
  departments: Department;
  positions: Position;
  employees: Employee;
  contracts: Contract;
  leave_requests: LeaveRequest;
  leave_balances: LeaveBalance;
  compensation_merit_cycles: CompensationMeritCycle;
  equity_grants: EquityGrant;
  payroll_runs: PayrollRun;
  payroll_slips: PayrollSlip;
  job_openings: JobOpening;
  candidates: Candidate;
  recruitment_costs: RecruitmentCost;
  notification_preferences: NotificationPreference;
  api_integrations: ApiIntegration;
  tenant_api_keys: TenantApiKey;
  webhooks: Webhook;
  webhook_deliveries: WebhookDelivery;
  users: User;
  password_reset_tokens: PasswordResetToken;
  onboarding_tasks: OnboardingTask;
  salary_histories: SalaryHistory;
  employee_documents: EmployeeDocument;
  attendances: Attendance;
  audit_logs: AuditLog;
  cv_analyses: CVAnalysis;
  schema_migrations: SchemaMigrations;
}