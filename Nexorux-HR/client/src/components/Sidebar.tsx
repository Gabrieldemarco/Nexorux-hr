import React, { useMemo, useCallback } from 'react';
import {
  LayoutDashboard, 
  Users, 
  Network, 
  Clock, 
  CalendarRange, 
  ReceiptText, 
  Briefcase, 
  CheckSquare, 
  FolderLock, 
  UserCheck, 
  BarChart3, 
  ShieldAlert,
  Settings,
  ChevronRight,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { UserRole } from '../types';

export type NavTab = 
  | 'dashboard'
  | 'employees'
  | 'organization'
  | 'attendance'
  | 'leaves'
  | 'payroll'
  | 'recruitment'
  | 'onboarding'
  | 'documents'
  | 'portal-ess'
  | 'reports'
  | 'audit'
  | 'settings'
  | 'compensation';

interface MenuItem {
  id: NavTab;
  label: string;
  icon: any;
  visible: boolean;
  badge?: string;
  count?: number;
}

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeRole: UserRole;
  pendingLeavesCount?: number;
  openJobsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  currentTab,
  onSelectTab,
  activeRole,
  pendingLeavesCount = 0,
  openJobsCount = 0
}) => {
  const isEmployeeOnly = activeRole === 'EMPLOYEE';
  const canManageRecruitment = ['SUPER_ADMIN', 'TENANT_OWNER', 'HR_ADMIN', 'HR_MANAGER', 'RECRUITER'].includes(activeRole);

  const menuSections: { title: string; items: MenuItem[] }[] = useMemo(() => [
    {
      title: 'PRINCIPAL',
      items: [
        { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard, visible: !isEmployeeOnly },
        { id: 'portal-ess' as NavTab, label: 'Portal del Empleado', icon: UserCheck, visible: true, badge: 'ESS' },
      ]
    },
    {
      title: 'GESTIÓN DE PERSONAS',
      items: [
        { id: 'employees' as NavTab, label: 'Empleados 360°', icon: Users, visible: !isEmployeeOnly },
        { id: 'organization' as NavTab, label: 'Estructura & Organigrama', icon: Network, visible: !isEmployeeOnly },
        { id: 'attendance' as NavTab, label: 'Control de Asistencia', icon: Clock, visible: true },
        { id: 'leaves' as NavTab, label: 'Vacaciones & Licencias', icon: CalendarRange, visible: true, count: pendingLeavesCount },
      ]
    },
    {
      title: 'TALENTO & CICLO DE VIDA',
      items: [
        { id: 'recruitment' as NavTab, label: 'Reclutamiento ATS', icon: Briefcase, visible: canManageRecruitment, count: openJobsCount },
        { id: 'onboarding' as NavTab, label: 'Onboarding & Checklists', icon: CheckSquare, visible: !isEmployeeOnly },
        { id: 'documents' as NavTab, label: 'Document Vault', icon: FolderLock, visible: true },
      ]
    },
    {
      title: 'NÓMINA & GOBERNANZA',
      items: [
        { id: 'payroll' as NavTab, label: 'Payroll Core & Motores', icon: ReceiptText, visible: !isEmployeeOnly && activeRole !== 'MANAGER' },
        { id: 'reports' as NavTab, label: 'Reportes & BI', icon: BarChart3, visible: !isEmployeeOnly },
        { id: 'audit' as NavTab, label: 'Auditoría & Logs', icon: ShieldAlert, visible: ['TENANT_OWNER', 'SUPER_ADMIN', 'HR_ADMIN'].includes(activeRole) },
        { id: 'settings' as NavTab, label: 'Configuración', icon: Settings, visible: ['TENANT_OWNER', 'SUPER_ADMIN', 'HR_ADMIN'].includes(activeRole) },
      ]
    },
    {
      title: 'COMPENSACIONES',
      items: [
        { id: 'compensation' as NavTab, label: 'Compensaciones & Equity', icon: DollarSign, visible: ['SUPER_ADMIN', 'TENANT_OWNER', 'HR_ADMIN'].includes(activeRole) },
      ]
    }
  ], [isEmployeeOnly, activeRole, pendingLeavesCount, openJobsCount, canManageRecruitment]);

  const handleTabSelect = useCallback((tab: NavTab) => {
    onSelectTab(tab);
  }, [onSelectTab]);

  return (
    <aside className="sidebar" role="navigation" aria-label="Navegación principal">
      <div className="sidebar-section">
        {menuSections.map((section, idx) => (
          <div key={idx}>
            <h3 className="sidebar-section-title">
              {section.title}
            </h3>

            <nav className="sidebar-menu" aria-label={section.title}>
              {section.items.filter(item => item.visible).map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabSelect(item.id)}
                    className="focus-visible"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: isActive ? 'rgba(99, 102, 241, 0.16)' : 'transparent',
                      color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                      border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: isActive ? 600 : 500,
                      transition: 'all 0.15s ease'
                    }}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={`${item.label}${item.count > 0 ? ` (${item.count} pendientes)` : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Icon size={16} style={{ color: isActive ? 'var(--brand-primary)' : 'currentColor' }} aria-hidden="true" />
                      <span>{item.label}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.badge && (
                        <span className="badge badge-success" style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: 'var(--accent-emerald)',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 5px',
                          borderRadius: '4px'
                        }} aria-hidden="true">
                          {item.badge}
                        </span>
                      )}
                      {Boolean(item.count && item.count > 0) && (
                        <span style={{
                          background: 'var(--brand-primary)',
                          color: '#fff',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '999px'
                        }} aria-label={`${item.count} items pendientes`}>
                          {item.count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Suite ecosystem card */}
      <div className="ecosystem-card" role="complementary" aria-label="Ecosistema Nexorux Suite">
        <div className="ecosystem-header">
          <span className="ecosystem-title">
            NEXORUX SUITE
          </span>
          <span className="ecosystem-status">
            CONNECTED
          </span>
        </div>
        <div className="ecosystem-grid">
          <div className="ecosystem-item">CRM</div>
          <div className="ecosystem-item">ERP</div>
          <div className="ecosystem-item active">HR</div>
          <div className="ecosystem-item">IA</div>
        </div>
      </div>
    </aside>
  );
});
