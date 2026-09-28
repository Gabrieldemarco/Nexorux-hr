import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  Star,
  Plus,
  ArrowRight,
  X,
  Trash2,
  Edit,
  UserPlus,
  UserCheck,
  Filter
} from 'lucide-react';
import { Candidate, CandidateStage, JobOpening, UserRole } from '../types';
import { apiFetch } from '../api';

interface OrgDepartment {
  id: string;
  name: string;
}

interface OrgPosition {
  id: string;
  title: string;
  department_id?: string;
}

interface RecruitmentViewProps {
  activeRole: UserRole;
  onCandidatesUpdated?: () => void;
  onNavigateToEmployee?: (employeeId: string) => void;
}

const emptyOpeningForm = {
  title: '',
  description: '',
  requirements: '',
  openingsCount: '1',
  departmentId: '',
  positionId: ''
};

const emptyCandidateForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  job_opening_id: '',
  notes: '',
  rating: '3'
};

export const RecruitmentView: React.FC<RecruitmentViewProps> = ({
  activeRole: _activeRole,
  onCandidatesUpdated,
  onNavigateToEmployee
}) => {
  const [openings, setOpenings] = useState<JobOpening[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [positions, setPositions] = useState<OrgPosition[]>([]);
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'CLOSED' | 'ALL'>('OPEN');
  const [loading, setLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpeningOpen, setIsEditOpeningOpen] = useState(false);
  const [isCandidateOpen, setIsCandidateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editingOpening, setEditingOpening] = useState<JobOpening | null>(null);
  const [form, setForm] = useState(emptyOpeningForm);
  const [candidateForm, setCandidateForm] = useState(emptyCandidateForm);
  const [detailNotes, setDetailNotes] = useState('');
  const [detailRating, setDetailRating] = useState(0);

  const stages: { stage: CandidateStage; label: string; color: string }[] = [
    { stage: 'APPLIED', label: 'Postulados', color: '#94A3B8' },
    { stage: 'SCREENING', label: 'Preselección', color: '#38BDF8' },
    { stage: 'INTERVIEW', label: 'Entrevistas', color: 'var(--brand-primary)' },
    { stage: 'TECHNICAL_TEST', label: 'Prueba Técnica', color: '#C084FC' },
    { stage: 'OFFER', label: 'Oferta', color: 'var(--accent-amber)' },
    { stage: 'HIRED', label: 'Contratados', color: 'var(--accent-emerald)' },
  ];

  const filteredOpenings = useMemo(() => {
    if (statusFilter === 'ALL') return openings;
    return openings.filter((o) => o.status === statusFilter);
  }, [openings, statusFilter]);

  const openOpenings = useMemo(() => openings.filter((o) => o.status === 'OPEN'), [openings]);

  const positionOptions = useMemo(() => {
    if (!form.departmentId) return positions;
    return positions.filter((p) => !p.department_id || p.department_id === form.departmentId);
  }, [positions, form.departmentId]);

  const notifyUpdated = () => {
    if (onCandidatesUpdated) onCandidatesUpdated();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobs, cands] = await Promise.all([
        apiFetch<JobOpening[]>('/recruitment/openings'),
        apiFetch<Candidate[]>(`/recruitment/candidates${selectedJob ? `?openingId=${selectedJob}` : ''}`)
      ]);
      setOpenings(jobs);
      setCandidates(cands.filter((c) => c.current_stage !== 'REJECTED'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadOrgOptions = async () => {
    try {
      const [deps, pos] = await Promise.all([
        apiFetch<OrgDepartment[]>('/org/departments'),
        apiFetch<OrgPosition[]>('/org/positions')
      ]);
      setDepartments(deps);
      setPositions(pos);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedJob]);

  useEffect(() => {
    loadOrgOptions();
  }, []);

  useEffect(() => {
    if (selectedCandidate) {
      setDetailNotes(selectedCandidate.notes || '');
      setDetailRating(selectedCandidate.rating || 0);
    }
  }, [selectedCandidate]);

  const openCreateCandidate = (jobOpeningId?: string) => {
    setError('');
    setCandidateForm({
      ...emptyCandidateForm,
      job_opening_id: jobOpeningId || selectedJob || (openOpenings[0]?.id ?? '')
    });
    setIsCandidateOpen(true);
  };

  const openCreateOpening = () => {
    setError('');
    setForm(emptyOpeningForm);
    setIsCreateOpen(true);
  };

  const handleMoveStage = async (candidateId: string, nextStage: CandidateStage) => {
    try {
      await apiFetch(`/recruitment/candidates/${candidateId}/stage`, {
        method: 'PUT',
        body: JSON.stringify({ stage: nextStage })
      });
      await loadData();
      notifyUpdated();
      if (selectedCandidate && selectedCandidate.id === candidateId) {
        setSelectedCandidate({ ...selectedCandidate, current_stage: nextStage });
      }
    } catch (err: any) {
      alert(`Error al mover candidato: ${err.message}`);
    }
  };

  const handleCreateOpening = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch('/recruitment/openings', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          requirements: form.requirements,
          openings_count: Number(form.openingsCount),
          department_id: form.departmentId || undefined,
          position_id: form.positionId || undefined
        })
      });
      setIsCreateOpen(false);
      setForm(emptyOpeningForm);
      setSuccessMessage('Vacante creada. Ahora podés agregar candidatos.');
      await loadData();
      notifyUpdated();
    } catch (err: any) {
      setError(err.message || 'No se pudo crear la vacante');
    } finally {
      setSaving(false);
    }
  };

  const handleEditOpening = (opening: JobOpening) => {
    setEditingOpening(opening);
    setError('');
    setForm({
      title: opening.title,
      description: opening.description || '',
      requirements: opening.requirements || '',
      openingsCount: String(opening.openings_count || 1),
      departmentId: opening.department_id || '',
      positionId: opening.position_id || ''
    });
    setIsEditOpeningOpen(true);
  };

  const handleUpdateOpening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOpening) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/recruitment/openings/${editingOpening.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          requirements: form.requirements,
          openings_count: Number(form.openingsCount),
          department_id: form.departmentId || undefined,
          position_id: form.positionId || undefined
        })
      });
      setIsEditOpeningOpen(false);
      setEditingOpening(null);
      setForm(emptyOpeningForm);
      await loadData();
      notifyUpdated();
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar la vacante');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOpening = async (openingId: string) => {
    if (!confirm('¿Cerrar esta vacante?')) return;
    try {
      await apiFetch(`/recruitment/openings/${openingId}`, { method: 'DELETE' });
      if (selectedJob === openingId) setSelectedJob('');
      await loadData();
      notifyUpdated();
    } catch (err: any) {
      alert(err.message || 'No se pudo cerrar la vacante');
    }
  };

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch('/recruitment/candidates', {
        method: 'POST',
        body: JSON.stringify({
          first_name: candidateForm.first_name,
          last_name: candidateForm.last_name,
          email: candidateForm.email,
          phone: candidateForm.phone || undefined,
          job_opening_id: candidateForm.job_opening_id,
          notes: candidateForm.notes || undefined,
          rating: Number(candidateForm.rating) || 0
        })
      });
      setIsCandidateOpen(false);
      setCandidateForm(emptyCandidateForm);
      setSuccessMessage('Candidato agregado al pipeline en Postulados.');
      await loadData();
      notifyUpdated();
    } catch (err: any) {
      setError(err.message || 'No se pudo crear el candidato');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCandidateDetails = async () => {
    if (!selectedCandidate) return;
    setSaving(true);
    setError('');
    try {
      const updated = await apiFetch<Candidate>(`/recruitment/candidates/${selectedCandidate.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name: selectedCandidate.first_name,
          last_name: selectedCandidate.last_name,
          email: selectedCandidate.email,
          phone: selectedCandidate.phone || undefined,
          notes: detailNotes || undefined,
          rating: detailRating
        })
      });
      setSelectedCandidate({
        ...selectedCandidate,
        notes: detailNotes,
        rating: detailRating,
        ...updated
      });
      await loadData();
      notifyUpdated();
      setSuccessMessage('Scorecard del candidato actualizado.');
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar el candidato');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectCandidate = async (candidateId: string) => {
    if (!confirm('¿Descartar este candidato?')) return;
    try {
      await apiFetch(`/recruitment/candidates/${candidateId}`, { method: 'DELETE' });
      setSelectedCandidate(null);
      await loadData();
      notifyUpdated();
    } catch (err: any) {
      alert(err.message || 'No se pudo descartar el candidato');
    }
  };

  const handleHireCandidate = async (candidateId: string) => {
    if (!confirm('¿Contratar a este candidato? Se creará el empleado y las tareas de onboarding.')) return;
    setHiring(true);
    setError('');
    try {
      const result = await apiFetch<{
        message: string;
        employeeId: string;
        openingClosed?: boolean;
      }>(`/recruitment/candidates/${candidateId}/hire`, { method: 'POST' });
      setSelectedCandidate(null);
      setSuccessMessage(result.message);
      await loadData();
      notifyUpdated();
      if (result.employeeId && onNavigateToEmployee) {
        const go = confirm('Empleado creado. ¿Ir a la ficha de empleados?');
        if (go) onNavigateToEmployee(result.employeeId);
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo contratar al candidato');
      alert(err.message || 'No se pudo contratar al candidato');
    } finally {
      setHiring(false);
    }
  };

  const openingFormFields = (
    <>
      <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
        Título del puesto
        <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Senior Backend Engineer" required />
      </label>
      <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
        Descripción
        <textarea className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Objetivo del rol y principales responsabilidades" required rows={3} />
      </label>
      <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
        Requisitos
        <textarea className="input-field" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} placeholder="Requisitos técnicos, experiencia, idiomas, etc." rows={3} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
          Departamento
          <select
            className="input-field"
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value, positionId: '' })}
          >
            <option value="">Sin asignar</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
          Posición
          <select
            className="input-field"
            value={form.positionId}
            onChange={(e) => setForm({ ...form, positionId: e.target.value })}
          >
            <option value="">Sin asignar</option>
            {positionOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
        Cantidad de vacantes
        <input className="input-field" type="number" min={1} value={form.openingsCount} onChange={(e) => setForm({ ...form, openingsCount: e.target.value })} required />
      </label>
    </>
  );

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-panel" style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ minWidth: 240, flex: 1 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Briefcase size={18} /> Reclutamiento ATS
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>
            Flujo: <strong style={{ color: 'var(--text-secondary)' }}>Vacante</strong> → <strong style={{ color: 'var(--text-secondary)' }}>Candidato</strong> → <strong style={{ color: 'var(--text-secondary)' }}>Etapas</strong> → <strong style={{ color: 'var(--text-secondary)' }}>Contratar</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <Filter size={14} />
            <select
              className="input-field"
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              style={{ minWidth: 180, padding: '8px 10px' }}
            >
              <option value="">Todas las vacantes</option>
              {openings.map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </label>
          <button className="btn-secondary" type="button" onClick={() => openCreateCandidate()} disabled={openOpenings.length === 0}>
            <UserPlus size={14} /> Nuevo candidato
          </button>
          <button className="btn-primary" type="button" onClick={openCreateOpening}>
            <Plus size={14} /> Nueva vacante
          </button>
        </div>
      </div>

      {successMessage && (
        <div role="status" style={{
          color: '#6EE7B7',
          background: 'rgba(52, 211, 153, 0.1)',
          border: '1px solid rgba(52, 211, 153, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12
        }}>
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage('')} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)' }}>Vacantes</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              ['OPEN', 'Activas'],
              ['CLOSED', 'Cerradas'],
              ['ALL', 'Todas']
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="btn-secondary"
                onClick={() => setStatusFilter(value)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  background: statusFilter === value ? 'var(--brand-primary)' : undefined,
                  color: statusFilter === value ? '#fff' : undefined,
                  borderColor: statusFilter === value ? 'transparent' : undefined
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredOpenings.length === 0 ? (
          <div className="glass-panel" style={{ padding: 28, borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
              {statusFilter === 'OPEN'
                ? 'No hay vacantes activas. Creá la primera para empezar el pipeline.'
                : 'No hay vacantes en este filtro.'}
            </p>
            {statusFilter === 'OPEN' && (
              <button className="btn-primary" type="button" onClick={openCreateOpening}>
                <Plus size={14} /> Crear vacante
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
            {filteredOpenings.map((job) => (
              <div
                key={job.id}
                className="glass-panel"
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  border: selectedJob === job.id ? '1px solid var(--brand-primary)' : undefined,
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedJob(selectedJob === job.id ? '' : job.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{job.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {(job.department_name || 'Sin depto')} • {(job.position_title || 'Sin posición')}
                    </div>
                  </div>
                  <span className={job.status === 'OPEN' ? 'badge badge-success' : 'badge'}>
                    {job.status === 'OPEN' ? 'Activa' : job.status === 'CLOSED' ? 'Cerrada' : job.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
                  <span>Candidatos: <strong style={{ color: 'var(--text-primary)' }}>{job.candidates_count || 0}</strong></span>
                  <span>Cupos: <strong style={{ color: 'var(--text-primary)' }}>{job.openings_count || 1}</strong></span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }} onClick={(e) => e.stopPropagation()}>
                  {job.status === 'OPEN' && (
                    <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }} onClick={() => openCreateCandidate(job.id)}>
                      <UserPlus size={12} /> Candidato
                    </button>
                  )}
                  <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', flex: 1 }} onClick={() => handleEditOpening(job)}>
                    <Edit size={12} /> Editar
                  </button>
                  {job.status === 'OPEN' && (
                    <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', flex: 1, color: '#FB7185', borderColor: 'rgba(244,63,94,0.4)' }} onClick={() => handleDeleteOpening(job.id)}>
                      <Trash2 size={12} /> Cerrar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${stages.length}, minmax(210px, 1fr))`,
        gap: '14px',
        overflowX: 'auto',
        paddingBottom: '16px',
        opacity: loading ? 0.7 : 1
      }}>
        {stages.map((st) => {
          const stageCandidates = candidates.filter((c) => c.current_stage === st.stage);
          return (
            <div
              key={st.stage}
              style={{
                background: 'var(--bg-sidebar)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-card)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '520px',
                padding: '12px'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '10px',
                borderBottom: `2px solid ${st.color}`,
                marginBottom: '12px'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{st.label}</span>
                <span style={{
                  background: 'var(--bg-card)',
                  color: st.color,
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '999px'
                }}>
                  {stageCandidates.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                {stageCandidates.length === 0 && (
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    padding: '20px 8px',
                    border: '1px dashed var(--border-card)',
                    borderRadius: 8
                  }}>
                    Sin candidatos
                    {st.stage === 'APPLIED' && openOpenings.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <button type="button" className="btn-secondary" style={{ fontSize: 10, padding: '4px 8px' }} onClick={() => openCreateCandidate()}>
                          Agregar candidato
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {stageCandidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="glass-panel"
                    onClick={() => setSelectedCandidate(cand)}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      borderLeft: `3px solid ${st.color}`
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {cand.first_name} {cand.last_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {cand.job_title}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={10}
                            color={star <= cand.rating ? '#F59E0B' : 'var(--text-muted)'}
                            fill={star <= cand.rating ? '#F59E0B' : 'transparent'}
                          />
                        ))}
                      </div>

                      {st.stage === 'OFFER' || (st.stage !== 'HIRED' && !cand.hired_employee_id) ? (
                        st.stage === 'OFFER' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHireCandidate(cand.id);
                            }}
                            style={{
                              background: 'rgba(52, 211, 153, 0.15)',
                              border: '1px solid rgba(52, 211, 153, 0.4)',
                              borderRadius: '4px',
                              padding: '3px 6px',
                              color: '#6EE7B7',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '10px'
                            }}
                            title="Contratar y crear empleado"
                          >
                            <UserCheck size={10} /> Contratar
                          </button>
                        ) : st.stage !== 'HIRED' ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentIdx = stages.findIndex((s) => s.stage === st.stage);
                              if (currentIdx < stages.length - 1) {
                                handleMoveStage(cand.id, stages[currentIdx + 1].stage);
                              }
                            }}
                            style={{
                              background: 'var(--bg-input)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: '4px',
                              padding: '3px 6px',
                              color: 'var(--brand-primary)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '10px'
                            }}
                            title="Avanzar a siguiente etapa"
                          >
                            <span>Avanzar</span>
                            <ArrowRight size={10} />
                          </button>
                        ) : null
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {isCreateOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.75)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsCreateOpen(false)}>
          <div className="glass-modal animate-fade-in" style={{ width: '520px', maxHeight: '90vh', overflow: 'auto', borderRadius: 'var(--radius-lg)', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Nueva vacante</h3>
              <button onClick={() => setIsCreateOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateOpening} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {openingFormFields}
              {error && <div role="alert" style={{ color: '#FB7185', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 'var(--radius-md)', padding: '10px', fontSize: '12px' }}>{error}</div>}
              <button className="btn-primary" type="submit" disabled={saving} style={{ marginTop: '4px' }}>
                {saving ? 'Guardando...' : 'Crear vacante'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isEditOpeningOpen && editingOpening && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.75)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setIsEditOpeningOpen(false); setEditingOpening(null); }}>
          <div className="glass-modal animate-fade-in" style={{ width: '520px', maxHeight: '90vh', overflow: 'auto', borderRadius: 'var(--radius-lg)', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Editar vacante</h3>
              <button onClick={() => { setIsEditOpeningOpen(false); setEditingOpening(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateOpening} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {openingFormFields}
              {error && <div role="alert" style={{ color: '#FB7185', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 'var(--radius-md)', padding: '10px', fontSize: '12px' }}>{error}</div>}
              <button className="btn-primary" type="submit" disabled={saving} style={{ marginTop: '4px' }}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isCandidateOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.75)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsCandidateOpen(false)}>
          <div className="glass-modal animate-fade-in" style={{ width: '520px', maxHeight: '90vh', overflow: 'auto', borderRadius: 'var(--radius-lg)', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Nuevo candidato</h3>
              <button onClick={() => setIsCandidateOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                  Nombre
                  <input className="input-field" value={candidateForm.first_name} onChange={(e) => setCandidateForm({ ...candidateForm, first_name: e.target.value })} required />
                </label>
                <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                  Apellido
                  <input className="input-field" value={candidateForm.last_name} onChange={(e) => setCandidateForm({ ...candidateForm, last_name: e.target.value })} required />
                </label>
              </div>
              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                Email
                <input className="input-field" type="email" value={candidateForm.email} onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })} required />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                  Teléfono
                  <input className="input-field" value={candidateForm.phone} onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })} />
                </label>
                <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                  Rating
                  <select className="input-field" value={candidateForm.rating} onChange={(e) => setCandidateForm({ ...candidateForm, rating: e.target.value })}>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n} / 5</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                Vacante
                <select className="input-field" value={candidateForm.job_opening_id} onChange={(e) => setCandidateForm({ ...candidateForm, job_opening_id: e.target.value })} required>
                  <option value="">Seleccionar...</option>
                  {openOpenings.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </label>
              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                Notas / scorecard
                <textarea className="input-field" value={candidateForm.notes} onChange={(e) => setCandidateForm({ ...candidateForm, notes: e.target.value })} placeholder="Notas de entrevista, scorecard, etc." rows={3} />
              </label>
              {error && <div role="alert" style={{ color: '#FB7185', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 'var(--radius-md)', padding: '10px', fontSize: '12px' }}>{error}</div>}
              <button className="btn-primary" type="submit" disabled={saving || openOpenings.length === 0} style={{ marginTop: '4px' }}>
                {saving ? 'Guardando...' : 'Crear candidato'}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedCandidate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 18, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setSelectedCandidate(null)}
        >
          <div
            className="glass-modal animate-fade-in"
            style={{ width: '560px', maxHeight: '90vh', overflow: 'auto', borderRadius: 'var(--radius-lg)', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <span className="badge badge-purple" style={{ marginBottom: '6px' }}>
                  {stages.find((s) => s.stage === selectedCandidate.current_stage)?.label || selectedCandidate.current_stage}
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {selectedCandidate.first_name} {selectedCandidate.last_name}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Vacante: {selectedCandidate.job_title}
                </div>
              </div>
              <button onClick={() => setSelectedCandidate(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="glass-panel" style={{ padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Email</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{selectedCandidate.email}</div>
                </div>
                <div className="glass-panel" style={{ padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Teléfono</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{selectedCandidate.phone || '—'}</div>
                </div>
              </div>

              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                Notas de entrevistas & scorecard
                <textarea
                  className="input-field"
                  value={detailNotes}
                  onChange={(e) => setDetailNotes(e.target.value)}
                  placeholder="Sin notas aún. Agregá observaciones de entrevista."
                  rows={4}
                />
              </label>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Rating</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setDetailRating(star)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}
                    >
                      <Star
                        size={18}
                        color={star <= detailRating ? '#F59E0B' : 'var(--text-muted)'}
                        fill={star <= detailRating ? '#F59E0B' : 'transparent'}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn-secondary" type="button" onClick={handleSaveCandidateDetails} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar scorecard'}
              </button>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Mover de etapa</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {stages.map((st) => (
                    <button
                      key={st.stage}
                      type="button"
                      onClick={() => handleMoveStage(selectedCandidate.id, st.stage)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: selectedCandidate.current_stage === st.stage ? st.color : 'var(--bg-card)',
                        color: selectedCandidate.current_stage === st.stage ? '#000' : 'var(--text-secondary)',
                        border: '1px solid var(--border-card)',
                        cursor: 'pointer'
                      }}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {!selectedCandidate.hired_employee_id && selectedCandidate.current_stage !== 'HIRED' && (
                  <button
                    className="btn-primary"
                    style={{ flex: 1 }}
                    disabled={hiring}
                    onClick={() => handleHireCandidate(selectedCandidate.id)}
                  >
                    <UserCheck size={14} /> {hiring ? 'Contratando...' : 'Contratar'}
                  </button>
                )}
                {selectedCandidate.hired_employee_id && onNavigateToEmployee && (
                  <button
                    className="btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => onNavigateToEmployee(selectedCandidate.hired_employee_id!)}
                  >
                    Ver empleado
                  </button>
                )}
                {!selectedCandidate.hired_employee_id && (
                  <button
                    className="btn-secondary"
                    style={{ flex: 1, color: '#FB7185', borderColor: 'rgba(244,63,94,0.4)' }}
                    onClick={() => handleRejectCandidate(selectedCandidate.id)}
                  >
                    <Trash2 size={14} /> Descartar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
