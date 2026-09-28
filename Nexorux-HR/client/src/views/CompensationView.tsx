import React, { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, Target, Award, BarChart3, Shield,
  Plus, Download, Filter, ChevronRight, Star, Gift, Zap, X
} from 'lucide-react';
import { UserRole } from '../types';
import { apiFetch } from '../api';
import { downloadCsv } from '../utils/downloadCsv';

interface CompensationViewProps {
  activeRole: UserRole;
}

interface SalaryBand {
  id: string;
  level: string;
  min_salary: number;
  max_salary: number;
  mid_salary: number;
  market_avg: number;
  headcount: number;
}

interface MeritCycle {
  id: string;
  employee_name: string;
  current_salary: number;
  proposed_salary: number;
  merit_score: number;
  performance_rating: string;
  effective_date: string;
  status: string;
}

interface EquityGrant {
  id: string;
  employee_name: string;
  type: string;
  shares: number;
  strike_price: number;
  vesting_years: number;
  cliff_months: number;
  status: string;
}

interface CompensationAnalytics {
  totalComp: number;
  equityValue: number;
  totalCompensation: number;
  activeMeritCycles: number;
  compRatioByLevel: { level: string; compRatio: number }[];
}

export const CompensationView: React.FC<CompensationViewProps> = ({ activeRole }) => {
  const [activeTab, setActiveTab] = useState<'bands' | 'merit' | 'equity' | 'analytics'>('bands');
  const [loading, setLoading] = useState(false);
  const [bands, setBands] = useState<SalaryBand[]>([]);
  const [meritCycles, setMeritCycles] = useState<MeritCycle[]>([]);
  const [equityGrants, setEquityGrants] = useState<EquityGrant[]>([]);
  const [analytics, setAnalytics] = useState<CompensationAnalytics | null>(null);
  const [selectedBand, setSelectedBand] = useState<SalaryBand | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [meritForm, setMeritForm] = useState({
    employeeId: '',
    currentSalary: '',
    proposedSalary: '',
    meritScore: '',
    performanceRating: 'Meets',
    effectiveDate: new Date().toISOString().split('T')[0]
  });

  const [equityForm, setEquityForm] = useState({
    employeeId: '',
    type: 'Options',
    shares: '',
    strikePrice: '',
    vestingYears: '4',
    cliffMonths: '12'
  });

  const canManageComp = ['SUPER_ADMIN', 'TENANT_OWNER', 'HR_ADMIN', 'HR_MANAGER'].includes(activeRole);

  const loadBands = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<SalaryBand[]>('/compensation/bands');
      setBands(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMeritCycles = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<MeritCycle[]>('/compensation/merit-cycles');
      setMeritCycles(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadEquityGrants = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<EquityGrant[]>('/compensation/equity-grants');
      setEquityGrants(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<CompensationAnalytics>('/compensation/analytics');
      setAnalytics(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'bands') loadBands();
    if (activeTab === 'merit') loadMeritCycles();
    if (activeTab === 'equity') loadEquityGrants();
    if (activeTab === 'analytics') loadAnalytics();
  }, [activeTab]);

  const handleCreateMeritCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch('/compensation/merit-cycle', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: meritForm.employeeId,
          currentSalary: Number(meritForm.currentSalary),
          proposedSalary: Number(meritForm.proposedSalary),
          meritScore: Number(meritForm.meritScore),
          performanceRating: meritForm.performanceRating,
          effectiveDate: meritForm.effectiveDate
        })
      });
      setIsCreateOpen(false);
      setMeritForm({ employeeId: '', currentSalary: '', proposedSalary: '', meritScore: '', performanceRating: 'Meets', effectiveDate: new Date().toISOString().split('T')[0] });
      loadMeritCycles();
    } catch (err: any) {
      setError(err.message || 'No se pudo crear el ciclo de méritos');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEquityGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch('/compensation/equity-grants', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: equityForm.employeeId,
          type: equityForm.type,
          shares: Number(equityForm.shares),
          strikePrice: Number(equityForm.strikePrice) || 0,
          vestingYears: Number(equityForm.vestingYears),
          cliffMonths: Number(equityForm.cliffMonths)
        })
      });
      setIsCreateOpen(false);
      setEquityForm({ employeeId: '', type: 'Options', shares: '', strikePrice: '', vestingYears: '4', cliffMonths: '12' });
      loadEquityGrants();
    } catch (err: any) {
      setError(err.message || 'No se pudo crear el equity grant');
    } finally {
      setSaving(false);
    }
  };

  const exportCompensationCsv = () => {
    const rows = [
      ...bands.map(b => ({ concepto: `Banda ${b.level}`, minimo: b.min_salary, maximo: b.max_salary, midpoint: b.mid_salary, mercado: b.market_avg, headcount: b.headcount })),
      ...meritCycles.map(m => ({ concepto: `Merit ${m.employee_name}`, minimo: m.current_salary, maximo: m.proposed_salary, midpoint: '-', mercado: '-', headcount: '-' }))
    ];
    downloadCsv(`compensacion-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="glass-panel" style={{
        padding: '20px 24px',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        background: 'var(--surface-gradient)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple">Compensation Intelligence</span>
            {canManageComp && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Admin Access</span>}
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Compensaciones & Estructura Salarial
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Bandas salariales, ciclos de méritos, equity, benchmarking de mercado y planificación presupuestaria.
          </p>
        </div>
        {canManageComp && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-primary" onClick={() => setIsCreateOpen(true)}>
              <Plus size={14} /><span>Nuevo Ciclo</span>
            </button>
            <button className="btn-secondary" onClick={exportCompensationCsv}>
              <Download size={14} /><span>Exportar</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-card)', paddingBottom: '0' }}>
        {[
          { id: 'bands', label: 'Bandas Salariales', icon: DollarSign },
          { id: 'merit', label: 'Ciclo de Méritos', icon: Award },
          { id: 'equity', label: 'Equity & Opciones', icon: Gift },
          { id: 'analytics', label: 'Analíticas', icon: BarChart3 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--brand-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--brand-primary)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '-1px'
            }}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando datos de compensación...</div>}

      {/* Salary Bands */}
      {activeTab === 'bands' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {bands.map((band, i) => {
              const compRatio = band.market_avg ? ((band.mid_salary / band.market_avg) * 100).toFixed(0) : '0';
              const penetration = (band.max_salary - band.min_salary) > 0 ? (((band.mid_salary - band.min_salary) / (band.max_salary - band.min_salary)) * 100).toFixed(0) : '0';
              const colors = ['#6366F1', '#EC4899', '#8B5CF6', '#10B981', '#F59E0B'];
              return (
                <div
                  key={band.id || i}
                  className="glass-panel"
                  onClick={() => setSelectedBand(band)}
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    border: selectedBand?.id === band.id ? '2px solid var(--brand-primary)' : '1px solid var(--border-card)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span className="badge" style={{ background: `${colors[i % colors.length]}20`, color: colors[i % colors.length], border: `1px solid ${colors[i % colors.length]}40` }}>
                      {band.level}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{band.headcount} colaboradores</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                    <div><div style={{ color: 'var(--text-muted)' }}>Mínimo</div><div style={{ fontWeight: 700 }}>${Number(band.min_salary).toLocaleString()}</div></div>
                    <div><div style={{ color: 'var(--text-muted)' }}>Máximo</div><div style={{ fontWeight: 700 }}>${Number(band.max_salary).toLocaleString()}</div></div>
                    <div><div style={{ color: 'var(--text-muted)' }}>Midpoint</div><div style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>${Number(band.mid_salary).toLocaleString()}</div></div>
                    <div><div style={{ color: 'var(--text-muted)' }}>Mercado</div><div style={{ fontWeight: 700 }}>${Number(band.market_avg).toLocaleString()}</div></div>
                  </div>
                  <div style={{ marginTop: '14px', display: 'flex', gap: '12px', fontSize: '11px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Comp Ratio: {compRatio}%</div>
                      <div style={{ height: '4px', background: 'var(--bg-input)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(Number(compRatio), 100)}%`, height: '100%', background: Number(compRatio) >= 95 ? '#10B981' : Number(compRatio) >= 85 ? '#F59E0B' : '#F43F5E' }} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Penetración: {penetration}%</div>
                      <div style={{ height: '4px', background: 'var(--bg-input)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${Number(penetration)}%`, height: '100%', background: 'var(--brand-primary)' }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Merit Cycle */}
      {activeTab === 'merit' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Salario Actual</th>
                  <th>Propuesto</th>
                  <th>Merit Score</th>
                  <th>Performance</th>
                  <th>Ajuste</th>
                  <th>Fecha Efectiva</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {meritCycles.map((item) => {
                  const adjustment = item.current_salary > 0 ? ((item.proposed_salary - item.current_salary) / item.current_salary * 100).toFixed(1) : '0';
                  const statusColors: any = { DRAFT: 'badge-info', SUBMITTED: 'badge-warning', APPROVED: 'badge-success', PENDING: 'badge-warning', REJECTED: 'badge-danger' };
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.employee_name}</td>
                      <td>${Number(item.current_salary).toLocaleString()}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>${Number(item.proposed_salary).toLocaleString()}</td>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Star size={12} color="#FBBF24" fill="#FBBF24" /><span style={{ fontWeight: 600 }}>{item.merit_score}</span></div></td>
                      <td><span className="badge badge-info">{item.performance_rating}</span></td>
                      <td style={{ color: Number(adjustment) > 0 ? '#34D399' : '#F87171', fontWeight: 600 }}>{Number(adjustment) > 0 ? '+' : ''}{adjustment}%</td>
                      <td>{item.effective_date}</td>
                      <td><span className={statusColors[item.status] || 'badge-info'}>{item.status}</span></td>
                      <td><ChevronRight size={14} color="var(--text-muted)" style={{ cursor: 'pointer' }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Equity */}
      {activeTab === 'equity' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Tipo</th>
                  <th>Acciones</th>
                  <th>Strike Price</th>
                  <th>Vesting</th>
                  <th>Cliff</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {equityGrants.map((grant) => {
                  const typeColors: any = { Options: '#6366F1', RSU: '#10B981', 'Phantom Stock': '#EC4899' };
                  return (
                    <tr key={grant.id}>
                      <td style={{ fontWeight: 600 }}>{grant.employee_name}</td>
                      <td><span className="badge" style={{ background: `${typeColors[grant.type] || '#6366F1'}20`, color: typeColors[grant.type] || '#6366F1', border: `1px solid ${typeColors[grant.type] || '#6366F1'}40` }}>{grant.type}</span></td>
                      <td style={{ fontWeight: 700 }}>{grant.shares.toLocaleString()}</td>
                      <td>{grant.strike_price > 0 ? `$${Number(grant.strike_price).toFixed(2)}` : 'N/A'}</td>
                      <td>{grant.vesting_years} años</td>
                      <td>{grant.cliff_months} meses</td>
                      <td><span className="badge badge-success">{grant.status}</span></td>
                      <td><button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>Ver Detalle</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics */}
      {activeTab === 'analytics' && !loading && analytics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {[
              { title: 'TOTAL COMP BUDGET', value: `$${Number(analytics.totalCompensation || 0).toLocaleString()}`, subtitle: 'Compensación total', icon: DollarSign, color: '#6366F1', trend: '+8.2%' },
              { title: 'FIXED COMP', value: `$${Number(analytics.totalComp || 0).toLocaleString()}`, subtitle: 'Salario base activo', icon: Shield, color: 'var(--accent-emerald)', trend: '—' },
              { title: 'EQUITY VALUE', value: `$${Number(analytics.equityValue || 0).toLocaleString()}`, subtitle: 'Fair value grants', icon: TrendingUp, color: 'var(--accent-rose)', trend: '+5%' },
              { title: 'CICLOS ACTIVOS', value: `${analytics.activeMeritCycles || 0}`, subtitle: 'Merit cycles en progreso', icon: Target, color: 'var(--accent-amber)', trend: '—' },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{kpi.title}</span>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${kpi.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={16} color={kpi.color} />
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)' }}>{kpi.value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>{kpi.subtitle}</div>
                  <div style={{ fontSize: '11px', color: kpi.trend.startsWith('+') ? '#34D399' : 'var(--text-muted)', marginTop: '8px' }}>{kpi.trend}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.75)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsCreateOpen(false)}>
          <div className="glass-modal animate-fade-in" style={{ width: '520px', borderRadius: 'var(--radius-lg)', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Nuevo Ciclo de Méritos</h3>
              <button onClick={() => setIsCreateOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateMeritCycle} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                Empleado
                <input className="input-field" value={meritForm.employeeId} onChange={e => setMeritForm({ ...meritForm, employeeId: e.target.value })} placeholder="ID del empleado" required />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                  Salario Actual
                  <input className="input-field" type="number" value={meritForm.currentSalary} onChange={e => setMeritForm({ ...meritForm, currentSalary: e.target.value })} required />
                </label>
                <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                  Salario Propuesto
                  <input className="input-field" type="number" value={meritForm.proposedSalary} onChange={e => setMeritForm({ ...meritForm, proposedSalary: e.target.value })} required />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                  Merit Score
                  <input className="input-field" type="number" step="0.1" min="0" max="5" value={meritForm.meritScore} onChange={e => setMeritForm({ ...meritForm, meritScore: e.target.value })} required />
                </label>
                <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                  Performance Rating
                  <select className="input-field" value={meritForm.performanceRating} onChange={e => setMeritForm({ ...meritForm, performanceRating: e.target.value })}>
                    <option value="Exceeds">Exceeds</option>
                    <option value="Meets">Meets</option>
                    <option value="Below">Below</option>
                  </select>
                </label>
              </div>
              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                Fecha Efectiva
                <input className="input-field" type="date" value={meritForm.effectiveDate} onChange={e => setMeritForm({ ...meritForm, effectiveDate: e.target.value })} required />
              </label>
              {error && <div role="alert" style={{ color: '#FB7185', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 'var(--radius-md)', padding: '10px', fontSize: '12px' }}>{error}</div>}
              <button className="btn-primary" type="submit" disabled={saving} style={{ marginTop: '4px' }}>
                {saving ? 'Guardando...' : 'Crear Ciclo'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
