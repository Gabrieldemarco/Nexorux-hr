import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Clock, 
  CalendarRange, 
  ReceiptText, 
  FileText, 
  CheckCircle2, 
  Plus, 
  Download, 
  Building2, 
  Mail, 
  Phone,
  ShieldCheck
} from 'lucide-react';
import { AuthUser, Employee } from '../types';
import { apiFetch } from '../api';

interface PortalESSViewProps {
  user: AuthUser;
}

export const PortalESSView: React.FC<PortalESSViewProps> = ({ user }) => {
  const [employee, setEmployee] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [clockMsg, setClockMsg] = useState('');
  const [isClocked, setIsClocked] = useState(false);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [slips, setSlips] = useState<any[]>([]);

  const loadMyData = async () => {
    setLoading(true);
    try {
      if (user.employee_id) {
        const full = await apiFetch<any>(`/employees/${user.employee_id}`);
        setEmployee(full);
        const leavesData = await apiFetch<any[]>(`/leaves?employeeId=${user.employee_id}`);
        setLeaves(leavesData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyData();
  }, [user.employee_id]);

  const handleClockIn = async () => {
    if (!employee) return;
    try {
      const res: any = await apiFetch('/attendance/clock-in', {
        method: 'POST',
        body: JSON.stringify({ employeeId: employee.id, notes: 'Fichaje desde Portal ESS' })
      });
      setIsClocked(true);
      setClockMsg(res.message || 'Entrada registrada con éxito');
      loadMyData();
      setTimeout(() => setClockMsg(''), 4000);
    } catch (err: any) {
      setClockMsg(err.message);
      setTimeout(() => setClockMsg(''), 4000);
    }
  };

  const handleClockOut = async () => {
    if (!employee) return;
    try {
      const res: any = await apiFetch('/attendance/clock-out', {
        method: 'POST',
        body: JSON.stringify({ employeeId: employee.id, notes: 'Salida desde Portal ESS' })
      });
      setIsClocked(false);
      setClockMsg(res.message || 'Salida registrada con éxito');
      loadMyData();
      setTimeout(() => setClockMsg(''), 4000);
    } catch (err: any) {
      setClockMsg(err.message);
      setTimeout(() => setClockMsg(''), 4000);
    }
  };

  const handleDownloadDocument = async (doc: any) => {
    try {
      const res = await fetch(`/api/v1/documents/${doc.id}/download`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('nexorux_access_token') || ''}`,
          'X-Tenant-ID': localStorage.getItem('nexorux_tenant_id') || ''
        }
      });
      if (!res.ok) throw new Error('No se pudo descargar el documento');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.title || 'documento';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Error al descargar el documento');
    }
  };

  if (!employee) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Cargando Portal del Empleado (Employee Self-Service)...
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Welcome Banner */}
      <div className="glass-panel" style={{
        padding: '24px',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        background: 'var(--surface-gradient)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img
            src={employee.photo_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160'}
            alt={employee.first_name}
            style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'cover', border: '2px solid var(--brand-primary)' }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-purple">PORTAL AUTOSERVICIO ESS</span>
              <span className="badge badge-success">ACTIVO</span>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
              Bienvenido, {employee.first_name} {employee.last_name}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {employee.position_title} • {employee.department_name} ({employee.employee_code})
            </div>
          </div>
        </div>

        {/* Quick ESS Clock-in buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleClockIn} className="btn-primary" style={{ background: '#10B981' }}>
            <Clock size={14} />
            <span>Fichar Entrada</span>
          </button>
          <button onClick={handleClockOut} className="btn-danger">
            <Clock size={14} />
            <span>Fichar Salida</span>
          </button>
        </div>
      </div>

      {clockMsg && (
        <div className="glass-panel animate-fade-in" style={{
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          borderLeft: '4px solid #10B981',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--accent-emerald)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          <span>{clockMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>SALDO DE VACACIONES DISPONIBLES</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '6px' }}>
            {employee.leaveBalances?.[0]?.remaining_days || 18} días
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Año {new Date().getFullYear()} • 20 días base
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>SALARIO VACACIONAL ESTIMADO</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--brand-primary)', marginTop: '6px' }}>
            ${employee.legalEntitlement?.estimatedVacationBonus?.toLocaleString() || 3333} {employee.currency}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Líquido legal previo a goce de licencia
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>DOCUMENTOS EN BÓVEDA</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '6px' }}>
            {employee.documents?.length || 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Contrato y certificados firmados
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>ONBOARDING CHECKLIST</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-rose)', marginTop: '6px' }}>
            {employee.onboardingTasks?.filter((t: any) => t.is_completed).length || 0} / {employee.onboardingTasks?.length || 0}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Tareas completadas
          </div>
        </div>
      </div>

      {/* Main Split: My Recent Attendance, My Documents, My Leaves, My Payroll */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Attendance */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Mis Marcas de Asistencia Recientes</h3>
            <span className="badge badge-info">Mes Actual</span>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Horas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {employee.attendances && employee.attendances.slice(0, 5).map((a: any, i: number) => (
                <tr key={i}>
                  <td>{a.date}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{a.clock_in || '--:--'}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{a.clock_out || '--:--'}</td>
                  <td>{a.regular_hours} hrs</td>
                  <td>
                    <span className={`badge ${a.status === 'PRESENT' ? 'badge-success' : 'badge-warning'}`}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Documents */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Mis Documentos Laborales</h3>
            <span className="badge badge-purple">Vault Seguro</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {employee.documents && employee.documents.map((d: any, i: number) => (
              <div
                key={i}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={16} color="#818CF8" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{d.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Categoría: {d.category}</div>
                  </div>
                </div>

                <button
                  onClick={() => handleDownloadDocument(d)}
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                >
                  <Download size={12} />
                  <span>Descargar</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leaves & Payroll Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Leaves */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Mis Licencias</h3>
            <span className="badge badge-info">Historial</span>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {leaves.slice(0, 5).map((l: any, i: number) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{l.leave_type}</td>
                  <td>{l.start_date}</td>
                  <td>{l.end_date}</td>
                  <td><span className={`badge ${l.status === 'APPROVED' ? 'badge-success' : l.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payroll */}
        <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Mis Recibos de Sueldo</h3>
            <span className="badge badge-purple">Liquidaciones</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {slips.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No hay recibos disponibles por el momento.</div>
            )}
            {slips.map((s: any, i: number) => (
              <div
                key={i}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{s.period_name || `Liquidación ${s.id}`}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Neto: ${Number(s.total_net).toLocaleString()} • {s.status}</div>
                </div>
                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                  <Download size={12} />
                  <span>PDF</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
