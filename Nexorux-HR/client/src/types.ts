export type UserRole = 
  | 'SUPER_ADMIN'
  | 'TENANT_OWNER'
  | 'HR_ADMIN'
  | 'HR_MANAGER'
  | 'MANAGER'
  | 'RECRUITER'
  | 'PAYROLL_MANAGER'
  | 'EMPLOYEE';

export interface AuthUser {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  employee_id?: string;
  status: 'ACTIVE' | 'SUSPENDED';
}

export type EmploymentStatus = 'ACTIVE' | 'PROBATION' | 'SUSPENDED' | 'TERMINATED';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type CandidateStage = 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'TECHNICAL_TEST' | 'OFFER' | 'HIRED' | 'REJECTED';

export interface Employee {
  id: string;
  tenant_id: string;
  company_id: string;
  company_name?: string;
  company_country?: string;
  branch_id: string;
  branch_name?: string;
  department_id: string;
  department_name?: string;
  position_id: string;
  position_title?: string;
  position_level?: string;
  manager_id?: string;
  manager_name?: string;
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
  contract_type: string;
  base_salary: number;
  currency: string;
  photo_url?: string;
  legalEntitlement?: {
    annualVacationDays: number;
    seniorityBonusDays: number;
    totalEntitledDays: number;
    legalBasis: string;
    estimatedVacationBonus: number;
    currency: string;
  };
  contracts?: any[];
  salaryHistories?: any[];
  documents?: any[];
  leaveBalances?: any[];
  attendances?: any[];
  onboardingTasks?: any[];
}

export interface DashboardMetrics {
  headcount: {
    total: number;
    active: number;
    probation: number;
    turnoverRateMonthly: number;
  };
  attendanceToday: {
    present: number;
    late: number;
    attendanceRate: number;
  };
  pendingLeavesCount: number;
  recruitment: {
    openJobsCount: number;
    candidatesInPipeline: number;
  };
  lastPayroll?: any;
  deptDistribution: { department: string; count: number }[];
  expiringContracts: any[];
  recentActivity: any[];
}

export interface ReportsAnalytics {
  turnoverRateMonthly: number;
  absenteeismRate: number;
  payrollByDepartment: { label: string; value: number }[];
  attendanceTrend: { date: string; rate: number }[];
  geographicDistribution: { countryCode: string; city: string; employeeCount: number }[];
  averageOnboardingDays: number | null;
  hiringCost: number | null;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  department_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: LeaveStatus;
  reason?: string;
  approver_name?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  department_name?: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  regular_hours: number;
  overtime_hours: number;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE';
  notes?: string;
}

export interface Candidate {
  id: string;
  job_opening_id: string;
  job_title?: string;
  department_name?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  current_stage: CandidateStage;
  rating: number;
  notes?: string;
  applied_date: string;
  hired_employee_id?: string | null;
}

export interface JobOpening {
  id: string;
  title: string;
  department_id?: string | null;
  position_id?: string | null;
  company_id?: string | null;
  department_name?: string;
  position_title?: string;
  description: string;
  requirements?: string;
  openings_count: number;
  candidates_count?: number;
  status: 'OPEN' | 'PAUSED' | 'CLOSED';
}

export interface PayrollRun {
  id: string;
  company_name?: string;
  period_name: string;
  period_type: string;
  country_code: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  total_employer_contributions: number;
  status: string;
  created_at: string;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  title: string;
  category: string;
  file_url: string;
  file_size_bytes: number;
  expiry_date?: string;
  is_confidential: number;
  uploaded_at: string;
}

export interface OnboardingTask {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  position_title?: string;
  title: string;
  description: string;
  category: string;
  due_date: string;
  is_completed: number;
  completed_at?: string;
}

export interface AuditLog {
  id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details_json: string;
  ip_address: string;
  created_at: string;
}

export interface SalaryBand {
  level: string;
  min_salary: number;
  max_salary: number;
  mid: number;
  marketAvg: number;
  headcount: number;
  compRatio: number;
  rangePenetration: number;
}

export interface MeritCycle {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  current_salary: number;
  proposed_salary: number;
  merit_score: number;
  performance_rating: string;
  effective_date: string;
  status: string;
  notes?: string;
  created_at: string;
}

export interface EquityGrant {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  grant_type: string;
  shares: number;
  strike_price: number;
  vesting_years: number;
  cliff_months: number;
  status: string;
  notes?: string;
  created_at: string;
}

export interface CompensationAnalytics {
  totalComp: number;
  equityValue: number;
  totalCompensation: number;
  activeMeritCycles: number;
  compRatioByLevel: { level: string; compRatio: number }[];
}
