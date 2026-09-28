import React from 'react';
import { 
  Users, 
  UserCheck, 
  CalendarRange, 
  Briefcase, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  ArrowUpRight, 
  CheckCircle2, 
  ReceiptText,
  FileCheck,
  ShieldCheck
} from 'lucide-react';
import { DashboardMetrics, Employee } from '../types';
import { NavTab } from '../components/Sidebar';
import { SkeletonStats, Skeleton } from '../components/SkeletonLoader';

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
  onNavigate: (tab: NavTab) => void;
  onSelectEmployeeId?: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  onNavigate,
  onSelectEmployeeId
}) => {
  if (!metrics) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header Banner Skeleton */}
        <div className="card">
          <div className="flex flex-col gap-3">
            <Skeleton width={200} height={24} variant="text" />
            <Skeleton width="60%" height={16} variant="text" />
            <div className="flex gap-3 mt-2">
              <Skeleton width={120} height={36} variant="rectangular" />
              <Skeleton width={120} height={36} variant="rectangular" />
            </div>
          </div>
        </div>

        {/* KPI Cards Skeleton */}
        <SkeletonStats count={4} />

        {/* Main Content Skeleton */}
        <div className="split-layout">
          <div className="flex flex-col gap-5">
            <div className="card">
              <div className="flex flex-col gap-3">
                <Skeleton width={150} height={20} variant="text" />
                <Skeleton width="70%" height={14} variant="text" />
                <div className="flex flex-col gap-3 mt-4">
                  <Skeleton width="100%" height={12} variant="text" />
                  <Skeleton width="100%" height={12} variant="text" />
                  <Skeleton width="100%" height={12} variant="text" />
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex flex-col gap-3">
                <Skeleton width={180} height={20} variant="text" />
                <Skeleton width="80%" height={14} variant="text" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-5">
            <div className="card">
              <div className="flex flex-col gap-3">
                <Skeleton width={120} height={20} variant="text" />
                <Skeleton width="60%" height={28} variant="text" />
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Skeleton width="100%" height={40} variant="rectangular" />
                  <Skeleton width="100%" height={40} variant="rectangular" />
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex flex-col gap-3">
                <Skeleton width={150} height={20} variant="text" />
                <div className="flex flex-col gap-3 mt-4">
                  <Skeleton width="100%" height={16} variant="text" />
                  <Skeleton width="100%" height={16} variant="text" />
                  <Skeleton width="100%" height={16} variant="text" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      title: 'HEADCOUNT ACTIVO',
      value: metrics.headcount.active,
      subtitle: `${metrics.headcount.probation} en período de prueba`,
      icon: Users,
      color: '#6366F1',
      trend: '+12% este trimestre',
      onClick: () => onNavigate('employees')
    },
    {
      title: 'ASISTENCIA HOY',
      value: `${metrics.attendanceToday.attendanceRate}%`,
      subtitle: `${metrics.attendanceToday.present} presentes • ${metrics.attendanceToday.late} tarde`,
      icon: Clock,
      color: 'var(--accent-emerald)',
      trend: 'Tasa óptima',
      onClick: () => onNavigate('attendance')
    },
    {
      title: 'LICENCIAS PENDIENTES',
      value: metrics.pendingLeavesCount,
      subtitle: 'Requieren aprobación de HR',
      icon: CalendarRange,
      color: 'var(--accent-amber)',
      trend: metrics.pendingLeavesCount > 0 ? 'Acción requerida' : 'Al día',
      onClick: () => onNavigate('leaves')
    },
    {
      title: 'PIPELINE TALENTO ATS',
      value: metrics.recruitment.candidatesInPipeline,
      subtitle: `${metrics.recruitment.openJobsCount} posiciones abiertas`,
      icon: Briefcase,
      color: 'var(--accent-rose)',
      trend: '3 ofertas en curso',
      onClick: () => onNavigate('recruitment')
    }
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '24px',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--surface-gradient)',
        border: '1px solid var(--border-card)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple" style={{ fontSize: '10px' }}>Nexorux HCM Platform</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Multi-Tenant • Enterprise Edition</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Panel de Control de Recursos Humanos
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Resumen en tiempo real de colaboradores, asistencia, novedades legales y flujos de aprobación.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => onNavigate('employees')} className="btn-primary">
            <Users size={14} />
            <span>Gestionar Empleados</span>
          </button>
          <button onClick={() => onNavigate('payroll')} className="btn-secondary">
            <ReceiptText size={14} />
            <span>Liquidación Nómina</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="glass-panel"
              onClick={kpi.onClick}
              style={{
                padding: '20px',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                transition: 'transform 0.2s, border-color 0.2s',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = 'var(--brand-primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border-card)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  {kpi.title}
                </span>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: `${kpi.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon size={16} color={kpi.color} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {kpi.value}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  {kpi.subtitle}
                </div>
              </div>

              <div style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: kpi.color
              }}>
                <span>{kpi.trend}</span>
                <ArrowUpRight size={14} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Operational Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Left Column: Department Distribution & Expiring Contracts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Department Breakdown */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Distribución por Departamento</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Headcount actual en la estructura de la empresa</p>
              </div>
              <button onClick={() => onNavigate('organization')} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                Ver Organigrama
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {metrics.deptDistribution.map((d, i) => {
                const total = metrics.headcount.total || 1;
                const pct = Math.round((d.count / total) * 100);
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.department}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{d.count} ({pct}%)</span>
                    </div>
                    <div style={{ height: '7px', background: 'var(--bg-input)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: 'var(--brand-gradient)',
                        borderRadius: '999px',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expiring Contracts & Probation Alerts */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <AlertTriangle size={18} color="#F59E0B" />
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Contratos y Períodos de Prueba a Vencer</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Alertas tempranas del Workflow Automation Engine (45 días)</p>
              </div>
            </div>

            {metrics.expiringContracts.length === 0 ? (
              <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
                No hay contratos con vencimiento inmediato en este período.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {metrics.expiringContracts.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        {c.first_name} {c.last_name} ({c.employee_code})
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {c.position_title} • Vencimiento: <strong style={{ color: 'var(--accent-amber)' }}>{c.end_date || c.probation_end_date}</strong>
                      </div>
                    </div>
                    <span className="badge badge-warning">Prueba por vencer</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Last Payroll Summary & Audit Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Last Payroll Run Box */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Última Liquidación de Nómina</h3>
              <span className="badge badge-success">APROBADO</span>
            </div>

            {metrics.lastPayroll ? (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {metrics.lastPayroll.period_name}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-emerald)', margin: '8px 0' }}>
                  ${Number(metrics.lastPayroll.total_net).toLocaleString()} USD
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px', marginTop: '12px' }}>
                  <div style={{ background: 'var(--bg-input)', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Bruto Devengado</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>${Number(metrics.lastPayroll.total_gross).toLocaleString()}</div>
                  </div>
                  <div style={{ background: 'var(--bg-input)', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>Aportes Patronales</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>${Number(metrics.lastPayroll.total_employer_contributions).toLocaleString()}</div>
                  </div>
                </div>

                <button
                  onClick={() => onNavigate('payroll')}
                  className="btn-secondary"
                  style={{ width: '100%', marginTop: '14px', fontSize: '12px' }}
                >
                  Inspeccionar Recibos & Motor País
                </button>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No hay liquidaciones previas registradas.</div>
            )}
          </div>

          {/* Real-time Audit Stream */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} color="#818CF8" />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Trazabilidad & Auditoría</h3>
              </div>
              <button onClick={() => onNavigate('audit')} style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: '11px', cursor: 'pointer' }}>
                Ver Todo
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {metrics.recentActivity.map((log, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--brand-primary)',
                    marginTop: '6px',
                    flexShrink: 0
                  }} />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {log.action.replace('_', ' ')}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      {log.user_email || 'Sistema'} • {log.created_at.split(' ')[1] || 'hace poco'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
