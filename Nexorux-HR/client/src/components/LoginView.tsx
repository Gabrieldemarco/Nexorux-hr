import React, { useState } from 'react';
import { ArrowLeft, LockKeyhole, Mail, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { apiFetch, login } from '../api';
import { AuthUser } from '../types';
import { useNavigate } from 'react-router-dom';
import { FormField, Form } from './FormField';
import { commonRules } from '../utils/validation';

interface LoginViewProps {
  onAuthenticated: (user: AuthUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onAuthenticated }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setFormErrors({});
    
    // Validate form
    const errors: { email?: string; password?: string } = {};
    
    if (!email.trim()) {
      errors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Ingresa un email válido';
    }
    
    if (!password) {
      errors.password = 'La contraseña es requerida';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setIsSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      onAuthenticated(user);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'No fue posible iniciar sesión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSubmitting(true);
    try {
      const response = await apiFetch<{ message: string; resetToken?: string }>('/auth/forgot-password', {
        method: 'POST', body: JSON.stringify({ email: email.trim() })
      }, false);
      setNotice(response.message);
      if (response.resetToken) {
        setResetToken(response.resetToken);
        setMode('reset');
      }
    } catch (err: any) {
      setError(err.message || 'No fue posible iniciar la recuperación');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSubmitting(true);
    try {
      const response = await apiFetch<{ message: string }>('/auth/reset-password', {
        method: 'POST', body: JSON.stringify({ token: resetToken.trim(), password: newPassword })
      }, false);
      setNotice(response.message);
      setPassword('');
      setNewPassword('');
      setMode('login');
    } catch (err: any) {
      setError(err.message || 'No fue posible actualizar la contraseña');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen grid items-center justify-center p-6" style={{ background: 'var(--bg-app)' }} role="main">
      <section className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '32px', borderRadius: 'var(--radius-lg)' }} aria-labelledby="login-title">
        <div className="flex items-center gap-3 mb-7">
          <div className="w-10 h-10 grid place-items-center rounded-xl" style={{ background: 'var(--brand-gradient)', color: '#fff', fontWeight: 800, fontSize: '18px' }} aria-hidden="true">N</div>
          <div>
            <h2 className="text-primary font-extrabold" style={{ letterSpacing: '0.03em' }}>NEXORUX HR</h2>
            <p className="text-muted text-xs">Acceso seguro a la plataforma</p>
          </div>
        </div>

        <div className="mb-6">
          <h1 id="login-title" className="text-primary text-2xl mb-2">{mode === 'login' ? 'Iniciar sesión' : mode === 'forgot' ? 'Recuperar contraseña' : 'Nueva contraseña'}</h1>
          <p className="text-secondary text-sm">{mode === 'login' ? 'Ingresa tus credenciales corporativas.' : mode === 'forgot' ? 'Te ayudaremos a recuperar el acceso.' : 'Define una contraseña nueva para tu cuenta.'}</p>
        </div>

        {mode === 'login' && <Form onSubmit={handleSubmit} isLoading={isSubmitting} aria-label="Formulario de inicio de sesión">
          <FormField
            label="Email corporativo"
            name="email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="nombre@empresa.com"
            required
            icon={<Mail size={15} />}
            error={formErrors.email}
            rules={commonRules.email}
            helperText="Ingresa tu correo electrónico corporativo"
          />
          
          <FormField
            label="Contraseña"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            required
            icon={<LockKeyhole size={15} />}
            error={formErrors.password}
            helperText="Ingresa tu contraseña"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          
          {error && <div role="alert" className="alert-box alert-error text-xs">{error}</div>}
          
          <button className="btn-primary" type="submit" disabled={isSubmitting} style={{ minHeight: '42px', marginTop: '4px' }} aria-busy={isSubmitting}>
            <ShieldCheck size={15} aria-hidden="true" />
            {isSubmitting ? 'Validando...' : 'Ingresar'}
          </button>
          
          <button 
            type="button" 
            onClick={() => { setMode('forgot'); setError(''); setNotice(''); setFormErrors({}); }} 
            className="text-transparent border-none bg-transparent cursor-pointer text-xs"
            style={{ color: 'var(--brand-primary)' }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </Form>}

        {mode === 'forgot' && <form onSubmit={handleForgotPassword} className="flex flex-col gap-4" aria-label="Formulario de recuperación de contraseña">
          <label className="flex flex-col gap-2 text-secondary text-xs font-semibold">
            <span>Email corporativo</span>
            <input 
              className="input-field" 
              type="email" 
              value={email} 
              onChange={event => setEmail(event.target.value)} 
              autoComplete="username" 
              required 
              aria-describedby="forgot-email-hint"
            />
            <span id="forgot-email-hint" className="sr-only">Ingresa tu correo electrónico para recuperar la contraseña</span>
          </label>
          <button className="btn-primary" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Generando...' : 'Enviar instrucciones'}
          </button>
          <button 
            type="button" 
            onClick={() => setMode('login')} 
            className="text-transparent border-none bg-transparent cursor-pointer text-xs flex items-center gap-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={13} aria-hidden="true" /> Volver al acceso
          </button>
        </form>}

        {mode === 'reset' && <Form onSubmit={handleResetPassword} isLoading={isSubmitting} aria-label="Formulario de restablecimiento de contraseña">
          <FormField
            label="Token de recuperación"
            name="resetToken"
            type="text"
            value={resetToken}
            onChange={setResetToken}
            required
            helperText="Ingresa el token de recuperación que recibiste por email"
          />
          <FormField
            label="Nueva contraseña"
            name="newPassword"
            type={showNewPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={setNewPassword}
            required
            icon={<LockKeyhole size={15} />}
            helperText="La contraseña debe tener al menos 8 caracteres"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          <button className="btn-primary" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </Form>}
        {notice && <div role="status" className="alert-box alert-success mt-4 text-xs">{notice}</div>}
      </section>
    </main>
  );
};
