import React, { useState } from 'react';
import { 
  Download, DollarSign, Globe, Target, Zap, RefreshCcw,
  ChevronUp, ChevronDown, Minus
} from 'lucide-react';
import { DashboardMetrics, ReportsAnalytics } from '../types';
import { downloadCsv } from '../utils/downloadCsv';
import { downloadPdf } from '../utils/exportPdf';

interface ReportsViewProps {
  metrics: DashboardMetrics | null;
  analytics: ReportsAnalytics | null;
}

// SVG Bar Chart Component
const BarChartSVG: React.FC<{ data: { label: string; value: number; color: string }[]; height?: number }> = ({
  data, height = 160
}) => {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = 100 / data.length;
  return (
    <svg width="100%" height={height} style={{ overflow: 'visible' }}>
      {data.map((d, i) => {
        const barH = (d.value / maxVal) * (height - 30);
        const x = (i * barWidth) + (barWidth * 0.15);
        const w = barWidth * 0.7;
        const y = height - 20 - barH;
        return (
          <g key={i}>
            <rect x={`${x}%`} y={y} width={`${w}%`} height={barH} rx={4} fill={d.color} opacity={0.85} />
            <text x={`${x + w / 2}%`} y={height - 2} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontFamily="Inter, sans-serif">{d.label}</text>
            <text x={`${x + w / 2}%`} y={y - 4} textAnchor="middle" fill="white" fontSize={9} fontFamily="Inter, sans-serif" fontWeight={700}>{d.value}</text>
          </g>
        );
      })}
    </svg>
  );
};

// SVG Donut Chart Component
const DonutChartSVG: React.FC<{ data: { label: string; value: number; color: string }[]; size?: number }> = ({
  data, size = 140
}) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = data.map(d => {
    const pct = d.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const startOffset = offset;
    offset += dash;
    return { ...d, dash, gap, startOffset };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--bg-input)" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => (
        <circle key={i} cx={cx} cy={cy} r={radius} fill="none" stroke={seg.color} strokeWidth={strokeWidth}
          strokeDasharray={`${seg.dash} ${seg.gap}`}
          strokeDashoffset={-seg.startOffset + circumference / 4}
          style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px` }} />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize={18} fontWeight={800} fontFamily="Inter, sans-serif">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize={9} fontFamily="Inter, sans-serif">TOTAL</text>
    </svg>
  );
};

// Line Sparkline
const SparklineSVG: React.FC<{ values: number[]; color?: string; height?: number }> = ({
  values, color = '#6366F1', height = 40
}) => {
  if (!values.length) return null;
  const max = Math.max(...values) || 1;
  const min = Math.min(...values);
  const range = max - min || 1;
  const width = 100;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4);
    return `${x},${y}`;
  });
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sparkGrad${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${height} ${pts.join(' ')} ${width},${height}`} fill={`url(#sparkGrad${color.replace('#','')})`} />
    </svg>
  );
};

type TrendDir = 'up' | 'down' | 'flat';
interface StatCard { title: string; value: string; subtitle: string; trend: TrendDir; trendVal: string; color: string; sparkline: number[]; }

const TrendIcon = ({ dir }: { dir: TrendDir }) => {
  if (dir === 'up') return <ChevronUp size={14} color="#F87171" />;
  if (dir === 'down') return <ChevronDown size={14} color="#34D399" />;
  return <Minus size={14} color="#FBBF24" />;
};

export const ReportsView: React.FC<ReportsViewProps> = ({ metrics, analytics }) => {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [refreshing, setRefreshing] = useState(false);

  const headcountData = metrics ? [
    ...metrics.deptDistribution.map((department, index) => ({ label: department.department, value: department.count, color: ['#6366F1', '#EC4899', '#8B5CF6', '#10B981', '#F59E0B'][index % 5] })),
  ].filter(d => d.value > 0) : [];

  const payrollDistribution = (analytics?.payrollByDepartment || []).map((item, index) => ({
    ...item,
    color: ['#6366F1', '#EC4899', '#8B5CF6', '#10B981', '#F59E0B'][index % 5]
  }));

  const attendanceTrend = analytics?.attendanceTrend.map(item => item.rate) || [metrics?.attendanceToday?.attendanceRate || 0];

  const statCards: StatCard[] = [
    { title: 'TASA DE ROTACIÓN', value: analytics ? `${analytics.turnoverRateMonthly}%` : '—', subtitle: 'Bajas en los últimos 30 días', trend: 'flat', trendVal: 'Calculado desde empleados', color: 'var(--accent-emerald)', sparkline: [analytics?.turnoverRateMonthly || 0] },
    { title: 'ÍNDICE DE AUSENTISMO', value: analytics ? `${analytics.absenteeismRate}%` : '—', subtitle: 'Ausencias de los últimos 30 días', trend: 'flat', trendVal: 'Calculado desde asistencia', color: 'var(--accent-amber)', sparkline: [analytics?.absenteeismRate || 0] },
    { title: 'COSTO POR CONTRATACIÓN', value: analytics?.hiringCost === null ? 'No disponible' : `$${analytics?.hiringCost?.toLocaleString()}`, subtitle: 'Promedio de costos ATS registrados', trend: 'flat', trendVal: 'Calculado desde reclutamiento', color: '#6366F1', sparkline: analytics?.hiringCost === null ? [] : [analytics?.hiringCost || 0] },
    { title: 'TIEMPO DE ONBOARDING', value: analytics?.averageOnboardingDays === null ? 'No disponible' : `${analytics?.averageOnboardingDays} días`, subtitle: 'Promedio de tareas completadas', trend: 'flat', trendVal: 'Calculado desde onboarding', color: 'var(--accent-rose)', sparkline: analytics?.averageOnboardingDays === null ? [] : [analytics?.averageOnboardingDays || 0] }
  ];

  const countryNames: Record<string, string> = { UY: 'Uruguay', AR: 'Argentina', BR: 'Brasil', US: 'Estados Unidos' };
  const geoTotal = analytics?.geographicDistribution.reduce((total, item) => total + item.employeeCount, 0) || 1;
  const geoData = (analytics?.geographicDistribution || []).map((item, index) => ({
    country: countryNames[item.countryCode] || item.countryCode,
    city: item.city,
    pct: Number(((item.employeeCount / geoTotal) * 100).toFixed(1)),
    color: ['#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'][index % 5]
  }));

  const exportReport = () => {
    downloadCsv(`reporte-hr-${new Date().toISOString().slice(0, 10)}.csv`, [
      { indicador: 'Tasa de rotación', valor: analytics?.turnoverRateMonthly, unidad: '%' },
      { indicador: 'Índice de ausentismo', valor: analytics?.absenteeismRate, unidad: '%' },
      { indicador: 'Costo por contratación', valor: analytics?.hiringCost, unidad: 'USD' },
      { indicador: 'Tiempo promedio onboarding', valor: analytics?.averageOnboardingDays, unidad: 'días' },
      ...payrollDistribution.map(item => ({ indicador: `Masa salarial - ${item.label}`, valor: item.value, unidad: '%' }))
    ]);
  };

  const exportReportPdf = () => {
    downloadPdf(`reporte-hr-${new Date().toISOString().slice(0, 10)}.pdf`, 'Reporte Ejecutivo Nexorux HR', [
      { indicador: 'Tasa de rotación', valor: `${analytics?.turnoverRateMonthly ?? '-'}%` },
      { indicador: 'Índice de ausentismo', valor: `${analytics?.absenteeismRate ?? '-'}%` },
      { indicador: 'Costo por contratación', valor: analytics?.hiringCost ?? 'No disponible' },
      { indicador: 'Tiempo promedio onboarding', valor: analytics?.averageOnboardingDays ?? 'No disponible' },
      ...payrollDistribution.map(item => ({ indicador: `Masa salarial - ${item.label}`, valor: `${item.value}%` }))
    ]);
  };

  if (!metrics || !analytics) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando analíticas de HR...</div>;
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple">NEXORUX BI</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>People Analytics Dashboard</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Reportes, Analytics & HR BI</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Indicadores ejecutivos de capital humano, masa salarial, rotación y demografía laboral.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '3px', border: '1px solid var(--border-card)' }}>
            {(['month', 'quarter', 'year'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ padding: '5px 12px', borderRadius: '6px', background: period === p ? 'var(--brand-primary)' : 'transparent', color: period === p ? '#fff' : 'var(--text-secondary)', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                {p === 'month' ? '30D' : p === 'quarter' ? 'Trimestre' : 'Año'}
              </button>
            ))}
          </div>
          <button onClick={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1200); }} className="btn-secondary" style={{ padding: '7px 12px' }}>
            <RefreshCcw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={exportReport} className="btn-primary">
            <Download size={14} /><span>Exportar Informe</span>
          </button>
          <button onClick={exportReportPdf} className="btn-secondary">
            <Download size={14} /><span>PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards with Sparklines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
        {statCards.map((card, i) => (
          <div key={i} className="glass-panel" style={{ padding: '18px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>{card.title}</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 2px' }}>{card.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{card.subtitle}</div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.35 }}>
              <SparklineSVG values={card.sparkline} color={card.color} height={44} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
              <TrendIcon dir={card.trend} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{card.trendVal}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
        {/* Headcount Bar Chart */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Headcount por Departamento</h3>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>Distribución del equipo actual</p>
          {headcountData.length > 0 ? <BarChartSVG data={headcountData} height={160} /> : (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Sin datos</div>
          )}
        </div>

        {/* Payroll Donut */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Distribución Masa Salarial</h3>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>% del gasto total en nómina</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <DonutChartSVG data={payrollDistribution} size={130} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
              {payrollDistribution.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: d.color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{d.label}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Attendance Sparkline */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Tendencia de Asistencia</h3>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Tasa últimas 7 jornadas (%)</p>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-emerald)', marginBottom: '12px' }}>{metrics.attendanceToday.attendanceRate}%</div>
          <SparklineSVG values={attendanceTrend} color="#10B981" height={60} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
            <span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Hoy</span>
          </div>
        </div>
      </div>

      {/* Lower: Geo + Payroll */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Globe size={16} color="#818CF8" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Distribución Geográfica & Filiales</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {geoData.map((c, i) => (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.country}</span>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.city}</div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: c.color }}>{c.pct}%</span>
                </div>
                <div style={{ height: '5px', background: 'var(--bg-input)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${c.pct}%`, height: '100%', background: c.color, borderRadius: '999px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <DollarSign size={16} color="#34D399" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Resumen Ejecutivo de Nómina</h3>
          </div>
          {metrics.lastPayroll ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '14px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Período: {metrics.lastPayroll.period_name}</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent-emerald)', margin: '4px 0' }}>
                  ${Number(metrics.lastPayroll.total_net).toLocaleString()} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>USD neto</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                {[
                  { label: 'Bruto Devengado', val: `$${Number(metrics.lastPayroll.total_gross).toLocaleString()}`, color: 'var(--text-primary)' },
                  { label: 'Aportes Patronales', val: `$${Number(metrics.lastPayroll.total_employer_contributions).toLocaleString()}`, color: 'var(--accent-rose)' },
                  { label: 'Liquidaciones', val: `${metrics.lastPayroll.employee_count || '—'} colab.`, color: 'var(--brand-primary)' },
                ].map((item, i) => (
                  <div key={i} style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '4px' }}>{item.label}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: item.color }}>{item.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '12px', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={13} />
                <span>Motor {metrics.lastPayroll.country_code || 'UY'} — Liquidación aprobada y cerrada</span>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '30px' }}>No hay liquidaciones registradas.</div>
          )}
        </div>
      </div>

      {/* ATS Recruitment Funnel */}
      <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={16} color="#EC4899" />
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Funnel de Reclutamiento ATS</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Conversión de candidatos por etapa del proceso de selección</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '18px' }}>{metrics.recruitment.openJobsCount}</div>
              <div style={{ color: 'var(--text-muted)' }}>Vacantes</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, color: 'var(--accent-rose)', fontSize: '18px' }}>{metrics.recruitment.candidatesInPipeline}</div>
              <div style={{ color: 'var(--text-muted)' }}>Candidatos</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
          {[
            { label: 'Postulados', val: metrics.recruitment.candidatesInPipeline, pct: 100, color: '#94A3B8' },
            { label: 'Preselección', val: Math.ceil(metrics.recruitment.candidatesInPipeline * 0.65), pct: 65, color: '#38BDF8' },
            { label: 'Entrevistas', val: Math.ceil(metrics.recruitment.candidatesInPipeline * 0.45), pct: 45, color: 'var(--brand-primary)' },
            { label: 'Prueba Téc.', val: Math.ceil(metrics.recruitment.candidatesInPipeline * 0.28), pct: 28, color: '#C084FC' },
            { label: 'Oferta', val: Math.ceil(metrics.recruitment.candidatesInPipeline * 0.14), pct: 14, color: 'var(--accent-amber)' },
            { label: 'Contratados', val: Math.max(1, Math.floor(metrics.recruitment.candidatesInPipeline * 0.05)), pct: 5, color: 'var(--accent-emerald)' },
          ].map((stage, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '100%', height: '80px', background: 'var(--bg-input)', borderRadius: '6px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${stage.pct}%`, background: stage.color, opacity: 0.8 }} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', zIndex: 1 }}>{stage.val}</div>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>{stage.label}</div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: stage.color }}>{stage.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
