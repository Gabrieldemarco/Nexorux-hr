import React, { useState, useEffect } from 'react';
import { FolderLock, FileText, AlertTriangle, Download, Search, Filter, UploadCloud, ShieldCheck, Edit, Trash2, X } from 'lucide-react';
import { EmployeeDocument } from '../types';
import { apiFetch, getAccessToken } from '../api';

export const DocumentsView: React.FC = () => {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadForm, setUploadForm] = useState({ employee_id: '', title: '', category: 'CONTRACT', expiry_date: '', file: null as File | null });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editingDoc, setEditingDoc] = useState<EmployeeDocument | null>(null);
  const [editForm, setEditForm] = useState({ title: '', category: 'CONTRACT', expiry_date: '' });

  useEffect(() => {
    loadDocuments();
    apiFetch<any[]>('/employees').then(setEmployees).catch(() => setEmployees([]));
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<EmployeeDocument[]>('/documents');
      setDocuments(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = documents.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) ||
      `${d.first_name} ${d.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      d.employee_code.toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCategory || d.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const uploadDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!uploadForm.file || !uploadForm.employee_id) return;
    setUploading(true);
    setUploadError('');
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(uploadForm.file as File);
      });
      await apiFetch('/documents', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: uploadForm.employee_id,
          title: uploadForm.title || uploadForm.file.name,
          category: uploadForm.category,
          expiry_date: uploadForm.expiry_date || null,
          fileName: uploadForm.file.name,
          mimeType: uploadForm.file.type || 'application/octet-stream',
          data
        })
      });
      setIsUploadOpen(false);
      setUploadForm({ employee_id: '', title: '', category: 'CONTRACT', expiry_date: '', file: null });
      loadDocuments();
    } catch (err: any) {
      setUploadError(err.message || 'No se pudo cargar el documento');
    } finally {
      setUploading(false);
    }
  };

  const downloadDocument = async (document: EmployeeDocument) => {
    const response = await fetch(`/api/v1/documents/${document.id}/download`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
    if (!response.ok) throw new Error('El archivo no está disponible');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = document.title || 'documento';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openEdit = (doc: EmployeeDocument) => {
    setEditingDoc(doc);
    setEditForm({ title: doc.title, category: doc.category, expiry_date: doc.expiry_date || '' });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;
    setSaving(true);
    setEditError('');
    try {
      await apiFetch(`/documents/${editingDoc.id}`, {
        method: 'PUT',
        body: JSON.stringify({ title: editForm.title, category: editForm.category, expiry_date: editForm.expiry_date || null })
      });
      setIsEditOpen(false);
      setEditingDoc(null);
      loadDocuments();
    } catch (err: any) {
      setEditError(err.message || 'No se pudo actualizar el documento');
    } finally {
      setSaving(false);
    }
  };

  const handleReplace = async (doc: EmployeeDocument) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setSaving(true);
      setEditError('');
      try {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await apiFetch(`/documents/${doc.id}/replace`, {
          method: 'POST',
          body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream', data })
        });
        loadDocuments();
      } catch (err: any) {
        alert(err.message || 'No se pudo reemplazar el documento');
      } finally {
        setSaving(false);
      }
    };
    input.click();
  };

  const handleDelete = async (doc: EmployeeDocument) => {
    if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return;
    try {
      await apiFetch(`/documents/${doc.id}`, { method: 'DELETE' });
      loadDocuments();
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar el documento');
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
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
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Bóveda Central de Documentos (Document Vault)</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Contratos, certificados de salud laboral, recibos firmados y políticas internas con alertas de vencimiento.
          </p>
        </div>

        <button onClick={() => setIsUploadOpen(true)} className="btn-primary">
          <UploadCloud size={14} />
          <span>Cargar Documento</span>
        </button>
      </div>

      {isUploadOpen && (
        <div className="glass-panel" style={{ padding: '18px', borderRadius: 'var(--radius-lg)' }}>
          <form onSubmit={uploadDocument} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <select className="input-field" value={uploadForm.employee_id} onChange={event => setUploadForm({ ...uploadForm, employee_id: event.target.value })} required>
              <option value="">Seleccionar empleado</option>
              {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}
            </select>
            <input className="input-field" placeholder="Título del documento" value={uploadForm.title} onChange={event => setUploadForm({ ...uploadForm, title: event.target.value })} />
            <select className="input-field" value={uploadForm.category} onChange={event => setUploadForm({ ...uploadForm, category: event.target.value })}>
              <option value="CONTRACT">Contrato</option><option value="CERTIFICATE">Certificado</option><option value="TAX_FORM">Formulario fiscal</option><option value="POLICY">Política</option>
            </select>
            <input className="input-field" type="date" value={uploadForm.expiry_date} onChange={event => setUploadForm({ ...uploadForm, expiry_date: event.target.value })} />
            <input className="input-field" type="file" onChange={event => setUploadForm({ ...uploadForm, file: event.target.files?.[0] || null })} required />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="btn-primary" type="submit" disabled={uploading}>{uploading ? 'Cargando...' : 'Guardar documento'}</button>
              <button className="btn-secondary" type="button" onClick={() => setIsUploadOpen(false)}>Cancelar</button>
              {uploadError && <span style={{ color: '#FB7185', fontSize: '11px' }}>{uploadError}</span>}
            </div>
          </form>
        </div>
      )}

      {/* Filter Bar */}
      <div className="glass-panel" style={{
        padding: '14px 20px',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Buscar por título de documento, colaborador o código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '34px' }}
          />
        </div>

        <select
          className="input-field"
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          style={{ width: '200px' }}
        >
          <option value="">Todas las categorías</option>
          <option value="CONTRACT">Contratos Laborales</option>
          <option value="CERTIFICATE">Certificados & Salud</option>
          <option value="TAX_FORM">Formularios Fiscales</option>
          <option value="POLICY">Políticas & Acuerdos</option>
          <option value="PAYSLIP">Recibos de Sueldo</option>
        </select>
      </div>

      {/* Documents Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Consultando bóveda...</div>
        ) : filteredDocs.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>No se encontraron documentos.</div>
        ) : (
          filteredDocs.map(doc => {
            const hasExpiry = Boolean(doc.expiry_date);
            return (
              <div
                key={doc.id}
                className="glass-panel"
                style={{
                  padding: '18px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <FileText size={18} color="#818CF8" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--brand-primary)', marginTop: '2px' }}>
                      {doc.first_name} {doc.last_name} ({doc.employee_code})
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  <span>Categoría: <strong style={{ color: 'var(--text-secondary)' }}>{doc.category}</strong></span>
                  {hasExpiry ? (
                    <span style={{ color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} />
                      Vence: {doc.expiry_date}
                    </span>
                  ) : (
                    <span>Permanente</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="badge badge-purple" style={{ fontSize: '9px' }}>
                    {doc.is_confidential ? 'CONFIDENCIAL' : 'GENERAL'}
                  </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button onClick={() => openEdit(doc)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                    <Edit size={12} />
                  </button>
                  <button onClick={() => handleReplace(doc)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>
                    <UploadCloud size={12} />
                  </button>
                  <button onClick={() => handleDelete(doc)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px', color: '#FB7185', borderColor: 'rgba(244,63,94,0.4)' }}>
                    <Trash2 size={12} />
                  </button>
                  <button
                    onClick={() => downloadDocument(doc).catch(err => setUploadError(err.message))}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px' }}
                  >
                    <Download size={12} />
                    <span>Descargar</span>
                  </button>
                </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Document Modal */}
      {isEditOpen && editingDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.75)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setIsEditOpen(false); setEditingDoc(null); }}>
          <div className="glass-modal animate-fade-in" style={{ width: '480px', borderRadius: 'var(--radius-lg)', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Editar Documento</h3>
              <button onClick={() => { setIsEditOpen(false); setEditingDoc(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                Título
                <input className="input-field" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} required />
              </label>
              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                Categoría
                <select className="input-field" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                  <option value="CONTRACT">Contrato</option>
                  <option value="CERTIFICATE">Certificado</option>
                  <option value="TAX_FORM">Formulario fiscal</option>
                  <option value="POLICY">Política</option>
                </select>
              </label>
              <label className="input-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>
                Vencimiento
                <input className="input-field" type="date" value={editForm.expiry_date} onChange={e => setEditForm({ ...editForm, expiry_date: e.target.value })} />
              </label>
              {editError && <div role="alert" style={{ color: '#FB7185', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 'var(--radius-md)', padding: '10px', fontSize: '12px' }}>{editError}</div>}
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
