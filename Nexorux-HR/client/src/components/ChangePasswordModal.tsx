import React, { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import { apiFetch } from '../api';

interface ChangePasswordModalProps {
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (newPassword !== confirmation) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }
    setSaving(true);
    try {
      const result = await apiFetch<{ message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setMessage(result.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
    } catch (err: any) {
      setError(err.message || 'No fue posible cambiar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', padding: '24px', background: 'rgba(2, 6, 23, 0.65)' }}>
      <section className="glass-modal" style={{ width: '100%', maxWidth: '420px', padding: '24px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><KeyRound size={17} color="var(--brand-primary)" /><h2 style={{ color: 'var(--text-primary)', fontSize: '18px' }}>Cambiar contraseña</h2></div>
          <button onClick={onClose} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={17} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
          <input className="input-field" type="password" placeholder="Contraseña actual" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" required />
          <input className="input-field" type="password" placeholder="Nueva contraseña (mínimo 8 caracteres)" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
          <input className="input-field" type="password" placeholder="Repetir nueva contraseña" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} required />
          {error && <div role="alert" style={{ color: '#FB7185', fontSize: '12px' }}>{error}</div>}
          {message && <div role="status" style={{ color: '#34D399', fontSize: '12px' }}>{message}</div>}
          <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar contraseña'}</button>
        </form>
      </section>
    </div>
  );
};
