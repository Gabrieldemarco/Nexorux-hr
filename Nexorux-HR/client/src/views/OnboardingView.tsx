import React, { useState, useEffect } from 'react';
import { CheckSquare, Clock, Users, CheckCircle2, AlertCircle, Filter, Plus, Trash2, Edit, X } from 'lucide-react';
import { OnboardingTask } from '../types';
import { apiFetch } from '../api';

export const OnboardingView: React.FC = () => {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingTask, setEditingTask] = useState<OnboardingTask | null>(null);

  const [form, setForm] = useState({
    employee_id: '',
    title: '',
    description: '',
    category: 'DOCUMENTATION',
    due_date: new Date().toISOString().split('T')[0]
  });

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<OnboardingTask[]>('/onboarding');
      setTasks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleToggle = async (taskId: string) => {
    try {
      await apiFetch(`/onboarding/${taskId}/toggle`, { method: 'PUT' });
      loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch('/onboarding', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setIsCreateOpen(false);
      setForm({ employee_id: '', title: '', description: '', category: 'DOCUMENTATION', due_date: new Date().toISOString().split('T')[0] });
      loadTasks();
    } catch (err: any) {
      setError(err.message || 'No se pudo crear la tarea');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/onboarding/${editingTask.id}`, {
        method: 'PUT',
        body: JSON.stringify(form)
      });
      setIsEditOpen(false);
      setEditingTask(null);
      setForm({ employee_id: '', title: '', description: '', category: 'DOCUMENTATION', due_date: new Date().toISOString().split('T')[0] });
      loadTasks();
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar la tarea');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('¿Eliminar esta tarea de onboarding?')) return;
    try {
      await apiFetch(`/onboarding/${taskId}`, { method: 'DELETE' });
      loadTasks();
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar la tarea');
    }
  };

  const openEdit = (task: OnboardingTask) => {
    setEditingTask(task);
    setForm({
      employee_id: task.employee_id,
      title: task.title,
      description: task.description || '',
      category: task.category,
      due_date: task.due_date || new Date().toISOString().split('T')[0]
    });
    setIsEditOpen(true);
  };

  const filteredTasks = filterCategory
    ? tasks.filter(t => t.category === filterCategory)
    : tasks;

  const completedCount = tasks.filter(t => t.is_completed).length;
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 100;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Bar */}
      <div className="glass-panel" style={{
        padding: '20px',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Onboarding & Workflows de Incorporación</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Checklists de bienvenida automáticos disparados ante cada nuevo colaborador.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Progreso General</div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent-emerald)' }}>{completedCount} de {tasks.length} completadas ({progressPct}%)</div>
          </div>
          <div style={{ width: '120px', height: '8px', background: 'var(--bg-input)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', background: '#10B981' }} />
          </div>
          <button className="btn-primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={14} /> Nueva Tarea
          </button>
        </div>
      </div>

      {/* Filter by Category */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {['', 'DOCUMENTATION', 'IT_SETUP', 'EQUIPMENT', 'MEETING', 'TRAINING'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: filterCategory === cat ? 'var(--brand-primary)' : 'var(--bg-card)',
              color: filterCategory === cat ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border-card)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {cat === '' ? 'Todas las Categorías' : cat}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Cargando checklists...</div>
        ) : filteredTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No hay tareas registradas.</div>
        ) : (
          filteredTasks.map(task => (
            <div
              key={task.id}
              className="glass-panel"
              style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderLeft: task.is_completed ? '4px solid #10B981' : '4px solid #6366F1',
                transition: 'all 0.15s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <input
                  type="checkbox"
                  checked={Boolean(task.is_completed)}
                  onChange={() => handleToggle(task.id)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: task.is_completed ? 'var(--text-muted)' : '#fff',
                    textDecoration: task.is_completed ? 'line-through' : 'none'
                  }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {task.description}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Colaborador: <strong style={{ color: 'var(--brand-primary)' }}>{task.first_name} {task.last_name}</strong> ({task.employee_code}) • Vence: {task.due_date}
                  </div>
                </div>
              </div>

              <span className={`badge ${task.is_completed ? 'badge-success' : 'badge-warning'}`}>
                {task.is_completed ? 'Completado' : task.category}
              </span>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => openEdit(task)}>
                  <Edit size={12} />
                </button>
                <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', color: '#FB7185', borderColor: 'rgba(244,63,94,0.4)' }} onClick={() => handleDelete(task.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Task Modal */}
      {isCreateOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.75)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsCreateOpen(false)}>
          <div className="glass-modal animate-fade-in" style={{ width: '480px', borderRadius: 'var(--radius-lg)', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Nueva Tarea de Onboarding</h3>
              <button onClick={() => setIsCreateOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                ID del Empleado
                <input className="input-field" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} placeholder="UUID del empleado" required />
              </label>
              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                Título
                <input className="input-field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej: Alta en sistema de RRHH" required />
              </label>
              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                Descripción
                <textarea className="input-field" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Pasos o responsable" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                  Categoría
                  <select className="input-field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    <option value="DOCUMENTATION">Documentación</option>
                    <option value="IT_SETUP">IT Setup</option>
                    <option value="EQUIPMENT">Equipamiento</option>
                    <option value="MEETING">Reunión</option>
                    <option value="TRAINING">Capacitación</option>
                  </select>
                </label>
                <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                  Vencimiento
                  <input className="input-field" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                </label>
              </div>
              {error && <div role="alert" style={{ color: '#FB7185', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 'var(--radius-md)', padding: '10px', fontSize: '12px' }}>{error}</div>}
              <button className="btn-primary" type="submit" disabled={saving} style={{ marginTop: '4px' }}>
                {saving ? 'Guardando...' : 'Crear Tarea'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {isEditOpen && editingTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.75)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setIsEditOpen(false); setEditingTask(null); }}>
          <div className="glass-modal animate-fade-in" style={{ width: '480px', borderRadius: 'var(--radius-lg)', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Editar Tarea</h3>
              <button onClick={() => { setIsEditOpen(false); setEditingTask(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                Título
                <input className="input-field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </label>
              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                Descripción
                <textarea className="input-field" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                  Categoría
                  <select className="input-field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    <option value="DOCUMENTATION">Documentación</option>
                    <option value="IT_SETUP">IT Setup</option>
                    <option value="EQUIPMENT">Equipamiento</option>
                    <option value="MEETING">Reunión</option>
                    <option value="TRAINING">Capacitación</option>
                  </select>
                </label>
                <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                  Vencimiento
                  <input className="input-field" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                </label>
              </div>
              {error && <div role="alert" style={{ color: '#FB7185', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 'var(--radius-md)', padding: '10px', fontSize: '12px' }}>{error}</div>}
              <button className="btn-primary" type="submit" disabled={saving} style={{ marginTop: '4px' }}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
