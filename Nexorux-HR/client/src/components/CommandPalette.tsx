import React, { useState, useEffect } from 'react';
import { Search, Users, CalendarRange, Clock, ReceiptText, Briefcase, FileText, Sparkles, ArrowRight, X } from 'lucide-react';
import { NavTab } from './Sidebar';
import { Employee } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onSelectEmployee: (emp: Employee) => void;
  onNavigate: (tab: NavTab) => void;
  onOpenAI: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  employees,
  onSelectEmployee,
  onNavigate,
  onOpenAI
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onClose(); // toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredEmployees = query
    ? employees.filter(e =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(query.toLowerCase()) ||
        e.employee_code.toLowerCase().includes(query.toLowerCase()) ||
        (e.position_title && e.position_title.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 5)
    : [];

  const quickNavigations: { tab: NavTab; label: string; icon: any }[] = [
    { tab: 'dashboard', label: 'Ir al Dashboard Ejecutivo', icon: Users },
    { tab: 'employees', label: 'Ver Directorio de Empleados', icon: Users },
    { tab: 'attendance', label: 'Registros de Asistencia y Tiempos', icon: Clock },
    { tab: 'leaves', label: 'Gestión de Vacaciones & Licencias', icon: CalendarRange },
    { tab: 'payroll', label: 'Liquidación de Nómina & Country Engines', icon: ReceiptText },
    { tab: 'recruitment', label: 'Pipeline de Reclutamiento ATS', icon: Briefcase },
    { tab: 'documents', label: 'Bóveda de Documentación Laboral', icon: FileText },
    { tab: 'reports', label: 'Reportes Analytics & HR BI', icon: ReceiptText },
    { tab: 'settings', label: 'Configuración del Sistema & Tenant', icon: Users },
  ];


  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(3, 7, 18, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '15vh',
      zIndex: 100
    }} onClick={onClose}>
      <div 
        className="glass-modal animate-fade-in"
        style={{
          width: '580px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border-card)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <Search size={18} color="var(--brand-primary)" />
          <input
            autoFocus
            type="text"
            placeholder="Escribe un comando o busca por empleado, puesto, código..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'var(--font-sans)'
            }}
          />
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* Results Container */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '12px' }}>
          {/* AI Quick prompt */}
          <div 
            onClick={() => { onClose(); onOpenAI(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.12))',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={16} color="#C084FC" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#E0E7FF' }}>Consultar a Nexorux IA</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pregunta sobre métricas, ausentismo o análisis salarial</div>
              </div>
            </div>
            <ArrowRight size={14} color="#C084FC" />
          </div>

          {/* Filtered Employees */}
          {filteredEmployees.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px', textTransform: 'uppercase' }}>
                Colaboradores Encontrados
              </div>
              {filteredEmployees.map(emp => (
                <div
                  key={emp.id}
                  onClick={() => { onSelectEmployee(emp); onClose(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <img
                    src={emp.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                    alt={emp.first_name}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {emp.first_name} {emp.last_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {emp.employee_code} • {emp.position_title} ({emp.department_name})
                    </div>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: '10px' }}>Ver Perfil 360°</span>
                </div>
              ))}
            </div>
          )}

          {/* Quick navigation */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 8px', textTransform: 'uppercase' }}>
              Navegación Rápida
            </div>
            {quickNavigations.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  onClick={() => { onNavigate(item.tab); onClose(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <Icon size={14} color="var(--brand-primary)" />
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer shortcuts */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'var(--bg-input)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '11px',
          color: 'var(--text-muted)'
        }}>
          <span>Navegar con teclado</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span><kbd>ESC</kbd> cerrar</span>
            <span><kbd>↵</kbd> seleccionar</span>
          </div>
        </div>
      </div>
    </div>
  );
};
