import React, { useState, useEffect } from 'react';
import { CalendarRange, Plus, CheckCircle2, XCircle, Clock, AlertCircle, Filter, X } from 'lucide-react';
import { LeaveRequest, UserRole } from '../types';
import { apiFetch } from '../api';

interface LeavesViewProps {
  activeRole: UserRole;
  onLeavesUpdated?: () => void;
}

export const LeavesView: React.FC<LeavesViewProps> = ({ activeRole, onLeavesUpdated }) => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const [formData, setFormData] = useState({
    employee_id: '',
    leave_type: 'VACATION',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    reason: ''
  });

  const canApprove = ['SUPER_ADMIN', 'TENANT_OWNER', 'HR_ADMIN', 'HR_MANAGER', 'MANAGER'].includes(activeRole);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const [data, emps] = await Promise.all([
        apiFetch<LeaveRequest[]>('/leaves'),
        apiFetch<any[]>('/employees')
      ]);
      setRequests(data);
      setEmployees(emps);
      if (emps.length > 0 && !formData.employee_id) {
        setFormData(prev => ({ ...prev, employee_id: emps[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      const res: any = await apiFetch(`/leaves/${id}/approve`, { method: 'PUT' });
      setActionMessage(res.message || 'Solicitud aprobada');
      loadLeaves();
      if (onLeavesUpdated) onLeavesUpdated();
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err: any) {
      alert(`Error al aprobar: ${err.message}`);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Ingrese el motivo del rechazo:') || 'No autorizada por necesidades operativas';
    try {
      const res: any = await apiFetch(`/leaves/${id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reason })
      });
      setActionMessage(res.message || 'Solicitud rechazada');
      loadLeaves();
      if (onLeavesUpdated) onLeavesUpdated();
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err: any) {
      alert(`Error al rechazar: ${err.message}`);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/leaves', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setIsModalOpen(false);
      setActionMessage('Solicitud enviada a revisión');
      loadLeaves();
      if (onLeavesUpdated) onLeavesUpdated();
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err: any) {
      alert(`Error al solicitar: ${err.message}`);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Bar */}
      <div className="glass-panel" style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Vacaciones y Licencias</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Workflow de solicitudes, aprobación multinivel y balance de días legales por país.
          </p>
        </div>

        <button onClick={() => setIsModalOpen(true)} className="btn-primary">
          <Plus size={14} />
          <span>Nueva Solicitud de Licencia</span>
        </button>
      </div>

      {actionMessage && (
        <div className="glass-panel animate-fade-in" style={{
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          borderLeft: '4px solid #10B981',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--accent-emerald)'
        }}>
          <CheckCircle2 size={16} />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Requests Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Departamento</th>
              <th>Tipo de Licencia</th>
              <th>Período Solicitado</th>
              <th>Días</th>
              <th>Motivo</th>
              <th>Estado</th>
              <th>Aprobador</th>
              {canApprove && <th style={{ textAlign: 'right' }}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canApprove ? 9 : 8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Cargando solicitudes de licencias...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={canApprove ? 9 : 8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No hay solicitudes de licencias registradas.
                </td>
              </tr>
            ) : (
              requests.map(req => (
                <tr key={req.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {req.first_name} {req.last_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {req.employee_code}
                    </div>
                  </td>
                  <td>{req.department_name}</td>
                  <td>
                    <span className="badge badge-purple">
                      {req.leave_type}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{req.start_date} al {req.end_date}</div>
                  </td>
                  <td>
                    <strong style={{ color: 'var(--text-primary)' }}>{req.days_count}</strong> días
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {req.reason || 'Sin observaciones'}
                    {req.rejection_reason && (
                      <div style={{ color: '#FB7185', fontSize: '10px', marginTop: '2px' }}>
                        Motivo rechazo: {req.rejection_reason}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${
                      req.status === 'APPROVED'
                        ? 'badge-success'
                        : req.status === 'PENDING'
                          ? 'badge-warning'
                          : 'badge-danger'
                    }`}>
                      {req.status === 'PENDING' ? 'Pendiente' : req.status === 'APPROVED' ? 'Aprobada' : 'Rechazada'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {req.approver_name || 'En espera de revisión'}
                    </div>
                  </td>

                  {canApprove && (
                    <td style={{ textAlign: 'right' }}>
                      {req.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleApprove(req.id)}
                            className="btn-primary"
                            style={{ padding: '5px 10px', fontSize: '11px', background: '#10B981' }}
                          >
                            <CheckCircle2 size={12} />
                            <span>Aprobar</span>
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            className="btn-danger"
                            style={{ padding: '5px 10px', fontSize: '11px' }}
                          >
                            <XCircle size={12} />
                            <span>Rechazar</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Procesada</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Request Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 7, 18, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }} onClick={() => setIsModalOpen(false)}>
          <div
            className="glass-modal animate-fade-in"
            style={{ width: '520px', borderRadius: 'var(--radius-lg)', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Solicitar Vacaciones o Licencia</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Colaborador</label>
                <select
                  className="input-field"
                  value={formData.employee_id}
                  onChange={e => setFormData({ ...formData, employee_id: e.target.value })}
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.employee_code}) - {emp.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tipo de Licencia</label>
                <select
                  className="input-field"
                  value={formData.leave_type}
                  onChange={e => setFormData({ ...formData, leave_type: e.target.value })}
                >
                  <option value="VACATION">Vacaciones Anuales Reglamentarias</option>
                  <option value="MEDICAL">Licencia Médica con Certificado</option>
                  <option value="STUDY">Licencia por Estudio / Examen</option>
                  <option value="MATERNITY">Licencia por Maternidad</option>
                  <option value="PATERNITY">Licencia por Paternidad</option>
                  <option value="BEREAVEMENT">Duelo Familiar Directo</option>
                  <option value="UNPAID">Licencia Extraordinaria sin goce</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Fecha Inicio</label>
                  <input
                    type="date"
                    required
                    className="input-field"
                    value={formData.start_date}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Fecha Fin</label>
                  <input
                    type="date"
                    required
                    className="input-field"
                    value={formData.end_date}
                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Motivo / Justificación</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={formData.reason}
                  onChange={e => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Detalle el motivo o adjunte referencias pertinentes..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Enviar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
