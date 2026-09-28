import React, { useMemo, useCallback, memo } from 'react';
import { UserRole } from '../types';
import {
  LayoutDashboard, Users, Network, Clock, CalendarRange,
  ReceiptText, Briefcase, CheckSquare, FolderLock,
  UserCheck, BarChart3, ShieldAlert, Settings,
  DollarSign
} from 'lucide-react';

type NavTab = 'dashboard' | 'employees' | 'organization' | 'attendance' | 'leaves' | 'payroll' | 'recruitment' | 'onboarding' | 'documents' | 'portal-ess' | 'reports' | 'audit' | 'settings' | 'compensation';

interface MobileNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeRole: UserRole;
  pendingLeavesCount?: number;
  openJobsCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = memo(({
  currentTab,
  onSelectTab,
  activeRole,
  pendingLeavesCount = 0,
  openJobsCount = 0
}) => {
  const isEmployeeOnly = activeRole === 'EMPLOYEE';
  const isAdmin = ['SUPER_ADMIN', 'TENANT_OWNER', 'HR_ADMIN'].includes(activeRole);
  const canManageRecruitment = ['SUPER_ADMIN', 'TENANT_OWNER', 'HR_ADMIN', 'HR_MANAGER', 'RECRUITER'].includes(activeRole);

  const allItems: { id: NavTab; label: string; icon: any; show: boolean; count?: number }[] = useMemo(() => [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard, show: true },
    { id: 'employees', label: 'Empleados', icon: Users, show: !isEmployeeOnly },
    { id: 'attendance', label: 'Asistencia', icon: Clock, show: true },
    { id: 'leaves', label: 'Licencias', icon: CalendarRange, show: true, count: pendingLeavesCount },
    { id: 'payroll', label: 'Nómina', icon: ReceiptText, show: !isEmployeeOnly && activeRole !== 'MANAGER' },
    { id: 'recruitment', label: 'Reclutamiento', icon: Briefcase, show: canManageRecruitment, count: openJobsCount },
    { id: 'portal-ess', label: 'Mi Portal', icon: UserCheck, show: true },
    { id: 'documents', label: 'Documentos', icon: FolderLock, show: true },
    { id: 'reports', label: 'Reportes', icon: BarChart3, show: !isEmployeeOnly },
    { id: 'compensation', label: 'Compensación', icon: DollarSign, show: !isEmployeeOnly && isAdmin },
    { id: 'settings', label: 'Config', icon: Settings, show: isAdmin },
  ], [isEmployeeOnly, activeRole, pendingLeavesCount, openJobsCount, isAdmin, canManageRecruitment]);

  const visibleItems = useMemo(() => allItems.filter(item => item.show), [allItems]);

  const handleTabSelect = useCallback((tab: NavTab) => {
    onSelectTab(tab);
  }, [onSelectTab]);

  return (
    <nav 
      className="mobile-nav" 
      role="navigation" 
      aria-label="Navegación móvil"
    >
      {visibleItems.map(item => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => handleTabSelect(item.id)}
            className={`mobile-nav-item focus-visible ${isActive ? 'active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            aria-label={`${item.label}${item.count > 0 ? ` (${item.count} pendientes)` : ''}`}
          >
            <div className="relative">
              <Icon size={18} aria-hidden="true" />
              {item.count && item.count > 0 && (
                <span 
                  className="absolute -top-1 -right-2 bg-red-500 text-white text-xs font-bold p-0 min-w-4 text-center leading-3 rounded-full"
                  aria-label={`${item.count} notificaciones`}
                >
                  {item.count > 9 ? '9+' : item.count}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
});
