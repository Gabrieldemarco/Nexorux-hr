import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getAccessToken, clearSession, setAccessToken, getTenantId } from '../api';
import { Employee, DashboardMetrics, ReportsAnalytics, AttendanceRecord, LeaveRequest, PayrollRun, JobOpening, Candidate, EmployeeDocument, OnboardingTask, AuditLog, SalaryBand, MeritCycle, EquityGrant, CompensationAnalytics } from '../types';

const API_BASE = '/api/v1';

async function apiFetchQuery<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const tenantId = getTenantId();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (tenantId) headers.set('X-Tenant-ID', tenantId);

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (res.status === 401) {
    clearSession();
    throw new Error('Sesión expirada');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Error de servidor' }));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export function useApiQuery<T>(
  key: string[],
  endpoint: string,
  options?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery({
    queryKey: key,
    queryFn: () => apiFetchQuery<T>(endpoint),
    enabled: options?.enabled !== false,
    staleTime: options?.staleTime ?? 1000 * 60 * 5,
  });
}

export function useApiMutation<TData = any, TVariables = any>(
  endpoint: string,
  method: string = 'POST',
  options?: { invalidateKeys?: string[][] }
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: TVariables) => apiFetchQuery<TData>(endpoint, {
      method,
      body: JSON.stringify(variables),
    }),
    onSuccess: () => {
      options?.invalidateKeys?.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      apiFetchQuery<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: (data) => {
      setAccessToken(data.token);
      localStorage.setItem('nexorux_role', data.user.role);
    },
  });
}

export function useAuthMe() {
  return useApiQuery<{ user: any }>(['auth', 'me'], '/auth/me');
}

export function useEmployees(params?: { search?: string; departmentId?: string; status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.departmentId) qs.set('departmentId', params.departmentId);
  if (params?.status) qs.set('status', params.status);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const qsStr = qs.toString();
  const queryKey = ['employees', params ? JSON.stringify(params) : 'all'] as [string, ...string[]];
  return useApiQuery<Employee[]>(queryKey, `/employees${qsStr ? `?${qsStr}` : ''}`);
}

export function useDashboardMetrics(enabled = true) {
  return useApiQuery<DashboardMetrics>(['dashboard', 'metrics'] as [string, ...string[]], '/dashboard/metrics', { enabled });
}

export function useAnalytics(enabled = true) {
  return useApiQuery<ReportsAnalytics>(['reports', 'analytics'] as [string, ...string[]], '/reports/analytics', { enabled });
}

export function useAttendance(date?: string) {
  const qs = date ? `?date=${date}` : '';
  const queryKey = ['attendance', date || 'all'] as [string, ...string[]];
  return useApiQuery<AttendanceRecord[]>(queryKey, `/attendance${qs}`);
}

export function useLeaves() {
  return useApiQuery<LeaveRequest[]>(['leaves'] as [string, ...string[]], '/leaves');
}

export function usePayrollRuns() {
  return useApiQuery<PayrollRun[]>(['payroll', 'runs'] as [string, ...string[]], '/payroll/runs');
}

export function useJobOpenings() {
  return useApiQuery<JobOpening[]>(['recruitment', 'openings'] as [string, ...string[]], '/recruitment/openings');
}

export function useCandidates(openingId?: string) {
  const qs = openingId ? `?openingId=${openingId}` : '';
  const queryKey = ['recruitment', 'candidates', openingId || 'all'] as [string, ...string[]];
  return useApiQuery<Candidate[]>(queryKey, `/recruitment/candidates${qs}`);
}

export function useDocuments() {
  return useApiQuery<EmployeeDocument[]>(['documents'] as [string, ...string[]], '/documents');
}

export function useOnboardingTasks() {
  return useApiQuery<OnboardingTask[]>(['onboarding'] as [string, ...string[]], '/onboarding');
}

export function useAuditLogs(limit = 50, offset = 0) {
  return useApiQuery<AuditLog[]>(['audit', String(limit), String(offset)] as [string, ...string[]], `/audit?limit=${limit}&offset=${offset}`);
}

export function useNotifications() {
  return useApiQuery<{ items: any[]; unreadCount: number }>(['notifications'] as [string, ...string[]], '/notifications');
}

export function useSalaryBands() {
  return useApiQuery<SalaryBand[]>(['compensation', 'bands'] as [string, ...string[]], '/compensation/bands');
}

export function useMeritCycles() {
  return useApiQuery<MeritCycle[]>(['compensation', 'merit-cycles'] as [string, ...string[]], '/compensation/merit-cycles');
}

export function useEquityGrants() {
  return useApiQuery<EquityGrant[]>(['compensation', 'equity-grants'] as [string, ...string[]], '/compensation/equity-grants');
}

export function useCompensationAnalytics() {
  return useApiQuery<CompensationAnalytics>(['compensation', 'analytics'] as [string, ...string[]], '/compensation/analytics');
}

