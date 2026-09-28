import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { CommandPalette } from './components/CommandPalette';
import { NexoruxAICopilot } from './components/NexoruxAICopilot';
import { MobileNav } from './components/MobileNav';
import { LoginView } from './components/LoginView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardView } from './views/DashboardView';
import { EmployeesView } from './views/EmployeesView';
import { OrganizationView } from './views/OrganizationView';
import { AttendanceView } from './views/AttendanceView';
import { LeavesView } from './views/LeavesView';
import { PayrollView } from './views/PayrollView';
import { RecruitmentView } from './views/RecruitmentView';
import { OnboardingView } from './views/OnboardingView';
import { DocumentsView } from './views/DocumentsView';
import { PortalESSView } from './views/PortalESSView';
import { ReportsView } from './views/ReportsView';
import { AuditView } from './views/AuditView';
import { SettingsView } from './views/SettingsView';
import { CompensationView } from './views/CompensationView';
import { AuthUser, DashboardMetrics, Employee, ReportsAnalytics, UserRole } from './types';
import { apiFetch, clearSession, getAccessToken, getTenantId, setTenantId } from './api';
import { useResponsive } from './hooks/useResponsive';
import { useDashboardMetrics, useAnalytics } from './hooks/useApi';
import { getErrorMessage, isAuthError } from './utils/errorHandler';
import './App.css';

const NAV_TABS = ['dashboard', 'employees', 'organization', 'attendance', 'leaves', 'payroll', 'recruitment', 'onboarding', 'documents', 'portal-ess', 'reports', 'audit', 'settings', 'compensation'] as const;
type NavTab = typeof NAV_TABS[number];

export const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { breakpoint, isMobile, sidebarOpen, setSidebarOpen, toggleSidebar } = useResponsive();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<UserRole>('HR_ADMIN');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('nexorux-theme') as 'dark' | 'light') || 'dark';
  });
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reportsAnalytics, setReportsAnalytics] = useState<ReportsAnalytics | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const { data: metricsData, refetch: refetchMetrics } = useDashboardMetrics(!!authUser);
  const { data: analyticsData } = useAnalytics(!!authUser);

  useEffect(() => {
    if (metricsData) {
      setMetrics(metricsData);
    }
  }, [metricsData]);

  useEffect(() => {
    if (analyticsData) {
      setReportsAnalytics(analyticsData);
    }
  }, [analyticsData]);

  useEffect(() => {
    getTenantId();
    if (!getAccessToken()) {
      setIsAuthLoading(false);
      return;
    }
    apiFetch<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => {
        setAuthUser(user);
        setActiveRole(user.role);
        setTenantId(user.tenant_id);
      })
      .catch((error) => {
        console.error('Auth error:', getErrorMessage(error));
        if (isAuthError(error)) {
          clearSession();
        }
      })
      .finally(() => setIsAuthLoading(false));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('nexorux-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (authUser?.role === 'EMPLOYEE') {
      navigate('/portal-ess', { replace: true });
    }
  }, [authUser, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    clearSession();
    setAuthUser(null);
    setMetrics(null);
    setEmployees([]);
    navigate('/login', { replace: true });
  };

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployeeId(emp.id);
    navigate('/employees');
  };

  const getCurrentTab = (): NavTab => {
    const path = location.pathname.replace('/', '') as NavTab;
    return NAV_TABS.includes(path) ? path : 'dashboard';
  };

  if (isAuthLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-app)', color: 'var(--text-muted)' }}>
        Validando sesión...
      </div>
    );
  }

  if (!authUser) {
    return <LoginView onAuthenticated={user => { setAuthUser(user); setActiveRole(user.role); }} />;
  }

  const currentTab = getCurrentTab();

  return (
    <ErrorBoundary>
      <div className="app-layout">
      {isMobile && sidebarOpen && (
        <div
          className="overlay"
          onClick={() => setSidebarOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Cerrar sidebar"
        />
      )}

      {isMobile ? (
        <MobileNav
          currentTab={currentTab}
          onSelectTab={(tab) => {
            navigate(`/${tab}`);
            setSidebarOpen(false);
          }}
          activeRole={activeRole}
          pendingLeavesCount={metrics?.pendingLeavesCount || 0}
          openJobsCount={metrics?.recruitment.openJobsCount || 0}
        />
      ) : (
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => navigate(`/${tab}`)}
          activeRole={activeRole}
          pendingLeavesCount={metrics?.pendingLeavesCount || 0}
          openJobsCount={metrics?.recruitment.openJobsCount || 0}
        />
      )}

      <div className="main-content">
        <TopBar
          onOpenSearch={() => setIsSearchOpen(true)}
          onToggleAI={() => setIsAIOpen(!isAIOpen)}
          activeRole={activeRole}
          user={authUser}
          onLogout={handleLogout}
          onChangePassword={() => setIsChangePasswordOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
        />

        <main className="main-content-body">
          <Routes>
            <Route path="/dashboard" element={
              <DashboardView
                metrics={metrics}
                onNavigate={(tab) => navigate(`/${tab}`)}
                onSelectEmployeeId={(id) => { setSelectedEmployeeId(id); navigate('/employees'); }}
              />
            } />
            <Route path="/employees" element={
              <EmployeesView
                activeRole={activeRole}
                selectedEmployeeId={selectedEmployeeId}
                onClearSelectedEmployee={() => setSelectedEmployeeId(null)}
              />
            } />
            <Route path="/organization" element={
              <OrganizationView
                onSelectEmployeeId={(id) => { setSelectedEmployeeId(id); navigate('/employees'); }}
              />
            } />
            <Route path="/attendance" element={<AttendanceView />} />
            <Route path="/leaves" element={
              <LeavesView
                activeRole={activeRole}
                onLeavesUpdated={() => {}}
              />
            } />
            <Route path="/payroll" element={
              <PayrollView
                activeRole={activeRole}
              />
            } />
            <Route path="/recruitment" element={
              <RecruitmentView
                activeRole={activeRole}
                onCandidatesUpdated={() => { void refetchMetrics(); }}
                onNavigateToEmployee={(id) => {
                  setSelectedEmployeeId(id);
                  navigate('/employees');
                }}
              />
            } />
            <Route path="/onboarding" element={<OnboardingView />} />
            <Route path="/documents" element={<DocumentsView />} />
            <Route path="/portal-ess" element={<PortalESSView user={authUser} />} />
            <Route path="/reports" element={
              <ReportsView
                metrics={metrics}
                analytics={reportsAnalytics}
              />
            } />
            <Route path="/audit" element={<AuditView />} />
            <Route path="/settings" element={
              <SettingsView
                activeRole={activeRole}
                theme={theme}
                onToggleTheme={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
              />
            } />
            <Route path="/compensation" element={
              <CompensationView activeRole={activeRole} />
            } />
            <Route path="/" element={<DashboardView metrics={metrics} onNavigate={(tab) => navigate(`/${tab}`)} onSelectEmployeeId={(id) => { setSelectedEmployeeId(id); navigate('/employees'); }} />} />
          </Routes>
        </main>
      </div>

      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        employees={employees}
        onSelectEmployee={handleSelectEmployee}
        onNavigate={(tab) => navigate(`/${tab}`)}
        onOpenAI={() => setIsAIOpen(true)}
      />

      <NexoruxAICopilot
        isOpen={isAIOpen}
        onClose={() => setIsAIOpen(false)}
      />

      {isChangePasswordOpen && <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />}
    </div>
    </ErrorBoundary>
  );
};
