import React, { useState, useEffect, useCallback, memo } from 'react';
import { 
  Search, 
  Sparkles, 
  Clock, 
  Moon,
  Sun,
  LogOut, 
  KeyRound,
  CheckCircle2,
  Bell,
  AlertCircle
} from 'lucide-react';
import { AuthUser, UserRole } from '../types';
import { apiFetch } from '../api';

interface TopBarProps {
  onOpenSearch: () => void;
  onToggleAI: () => void;
  activeRole: UserRole;
  user: AuthUser;
  onLogout: () => void;
  onChangePassword: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const TopBar: React.FC<TopBarProps> = memo(({
  onOpenSearch,
  onToggleAI,
  activeRole,
  theme,
  onToggleTheme,
  user,
  onLogout,
  onChangePassword
}) => {
  const [clockedIn, setClockedIn] = useState<boolean>(false);
  const [clockMessage, setClockMessage] = useState<string>('');
  const [isClocking, setIsClocking] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsRead, setNotificationsRead] = useState(() => localStorage.getItem('nexorux-notifications-read') === 'true');

  useEffect(() => {
    apiFetch<{ items: any[] }>('/notifications').then(result => setNotifications(result.items)).catch(() => setNotifications([]));
  }, []);

  const markNotificationsRead = useCallback(() => {
    setNotificationsRead(true);
    localStorage.setItem('nexorux-notifications-read', 'true');
  }, []);

  const handleClockToggle = useCallback(async () => {
    setIsClocking(true);
    try {
      if (!clockedIn) {
        const res: any = await apiFetch('/attendance/clock-in', {
          method: 'POST',
          body: JSON.stringify({ employeeId: user.employee_id, notes: 'Fichaje web rápido desde TopBar' })
        });
        setClockedIn(true);
        setClockMessage(res.message || 'Entrada registrada');
      } else {
        const res: any = await apiFetch('/attendance/clock-out', {
          method: 'POST',
            body: JSON.stringify({ employeeId: user.employee_id, notes: 'Fichaje de salida web' })
        });
        setClockedIn(false);
        setClockMessage(res.message || 'Salida registrada');
      }
      setTimeout(() => setClockMessage(''), 4000);
    } catch (err: any) {
      setClockMessage(err.message);
      setTimeout(() => setClockMessage(''), 4000);
    } finally {
      setIsClocking(false);
    }
  }, [clockedIn, user.employee_id]);

  return (
    <header className="glass-panel top-bar" role="banner">
      {/* Left: Tenant Context and Global Search */}
      <div className="top-bar-left">
        <div className="logo-section">
          <div className="logo-icon" aria-hidden="true">N</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="logo-text">
                NEXORUX
              </span>
              <span className="badge badge-purple" style={{
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818CF8',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '4px'
              }}>
                HR
              </span>
            </div>
            <span className="logo-subtitle">
              Nexorux Technologies LLC • Multi-Tenant
            </span>
          </div>
        </div>

        {/* Global Search Button / Trigger for Cmd+K */}
        <button
          onClick={onOpenSearch}
          className="search-bar"
          aria-label="Abrir búsqueda global (Ctrl+K)"
        >
          <Search size={14} color="var(--text-muted)" aria-hidden="true" />
          <span className="flex-1 text-left">Buscar empleados, acciones...</span>
          <kbd style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            padding: '1px 6px',
            fontSize: '10px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)'
          }}>
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: Quick Clock-In, Role Switcher, AI Trigger, User profile */}
      <div className="top-bar-right">
        {/* Live Attendance Clock button */}
        <div className="relative">
          <button
            onClick={handleClockToggle}
            disabled={isClocking}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: clockedIn ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.12)',
              border: `1px solid ${clockedIn ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.3)'}`,
              color: clockedIn ? 'var(--accent-emerald)' : 'var(--accent-rose)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            aria-label={clockedIn ? 'Fichar salida' : 'Fichar entrada'}
            aria-busy={isClocking}
          >
            <Clock size={14} className={clockedIn ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{clockedIn ? 'En Jornada (Fichar Salida)' : 'Fichar Entrada'}</span>
          </button>

          {clockMessage && (
            <div 
              className="absolute top-full right-0 z-50 flex items-center gap-2 bg-card border border-card rounded-lg p-2 text-xs text-primary shadow-md whitespace-nowrap"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 size={12} color="#10B981" aria-hidden="true" />
              {clockMessage}
            </div>
          )}
        </div>

        {/* Nexorux IA Trigger */}
        <button
          onClick={onToggleAI}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(168,85,247,0.18))',
            border: '1px solid rgba(168,85,247,0.4)',
            color: '#C084FC',
            padding: '6px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          aria-label="Abrir asistente Nexorux IA"
        >
          <Sparkles size={14} aria-hidden="true" />
          <span>Nexorux IA</span>
        </button>

        <button
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
          className="focus-visible"
          style={{
            width: '34px',
            height: '34px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          {theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
        </button>

        <div className="relative">
          <button 
            onClick={() => { setNotificationsOpen(value => !value); markNotificationsRead(); }} 
            aria-label={`Notificaciones ${!notificationsRead && notifications.length > 0 ? `(${notifications.length} nuevas)` : ''}`}
            aria-expanded={notificationsOpen}
            aria-haspopup="true"
            className="focus-visible"
            style={{ width: '34px', height: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-card)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
          >
            <Bell size={15} aria-hidden="true" />
            {!notificationsRead && notifications.length > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 p-0 grid place-items-center rounded-full bg-red-500 text-white text-xs font-extrabold" aria-label={`${notifications.length} notificaciones nuevas`}>{notifications.length > 9 ? '9+' : notifications.length}</span>}
          </button>
          {notificationsOpen && <div className="glass-modal absolute top-full right-0 w-80 max-h-90 overflow-y-auto p-3 rounded-lg shadow-lg z-70" role="dialog" aria-label="Centro de actividad">
            <div className="flex justify-between items-center p-2 pb-3 border-b border-subtle"><strong className="text-xs text-primary">Centro de actividad</strong><span className="text-xs text-muted">{notifications.length} eventos</span></div>
            {notifications.length === 0 ? <div className="p-5 text-muted text-xs">No hay actividad reciente.</div> : notifications.map(item => <div key={item.id} className="p-3 border-b border-subtle"><div className="text-xs font-bold text-primary">{item.action.replace(/_/g, ' ')}</div><div className="mt-1 text-xs text-muted">{item.resource_type} · {item.created_at}</div></div>)}
          </div>}
        </div>

        <div className="user-section">
          <div className="user-info">
            <div className="user-name">{user.first_name} {user.last_name}</div>
            <div className="user-role">{activeRole.replace('_', ' ')}</div>
          </div>
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
            alt={`Avatar de ${user.first_name} ${user.last_name}`}
            className="user-avatar"
          />
          <button 
            onClick={onChangePassword} 
            className="btn-secondary focus-visible" 
            style={{ padding: '6px 9px' }} 
            title="Cambiar contraseña" 
            aria-label="Cambiar contraseña"
          >
            <KeyRound size={14} aria-hidden="true" />
          </button>
          <button 
            onClick={onLogout} 
            className="btn-secondary focus-visible" 
            style={{ padding: '6px 9px' }} 
            title="Cerrar sesión" 
            aria-label="Cerrar sesión"
          >
            <LogOut size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
});
