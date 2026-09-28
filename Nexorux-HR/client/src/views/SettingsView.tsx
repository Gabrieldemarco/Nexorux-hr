import React, { useEffect, useState } from 'react';
import {
  Settings, Building2, Users, Bell, Shield, Globe, CreditCard,
  Mail, Sliders, ChevronRight, CheckCircle2, AlertTriangle,
  Lock, Eye, EyeOff, Save, RotateCcw, Zap, Database, Webhook,
  Key, UserCog, Palette, Monitor
} from 'lucide-react';
import { UserRole } from '../types';
import { apiFetch } from '../api';

interface SettingsViewProps {
  activeRole: UserRole;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

type SettingsTab = 'company' | 'users' | 'notifications' | 'security' | 'integrations' | 'appearance' | 'billing';

const SettingsSidebar: React.FC<{ active: SettingsTab; onSelect: (t: SettingsTab) => void }> = ({ active, onSelect }) => {
  const items: { id: SettingsTab; label: string; icon: any; badge?: string }[] = [
    { id: 'company', label: 'Empresa & Tenant', icon: Building2 },
    { id: 'users', label: 'Usuarios & Roles', icon: UserCog },
    { id: 'notifications', label: 'Notificaciones', icon: Bell, badge: '3' },
    { id: 'security', label: 'Seguridad & Acceso', icon: Shield },
    { id: 'integrations', label: 'Integraciones & API', icon: Webhook },
    { id: 'appearance', label: 'Apariencia & UI', icon: Palette },
    { id: 'billing', label: 'Suscripción & Facturación', icon: CreditCard },
  ];

  return (
    <div style={{
      width: '220px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '2px'
    }}>
      {items.map(item => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: isActive ? 'rgba(99, 102, 241, 0.16)' : 'transparent',
              color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
              border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 500,
              width: '100%',
              textAlign: 'left',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Icon size={15} style={{ color: isActive ? 'var(--brand-primary)' : 'currentColor' }} />
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <span style={{ background: 'var(--accent-rose)', color: 'var(--text-primary)', fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '999px' }}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// Toggle Switch
const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; label?: string }> = ({ value, onChange, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    {label && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>}
    <button
      onClick={() => onChange(!value)}
      style={{
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        background: value ? 'var(--brand-primary)' : 'var(--bg-input)',
        border: `1px solid ${value ? 'var(--brand-primary)' : 'var(--border-card)'}`,
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s',
        flexShrink: 0
      }}
    >
      <div style={{
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: 'var(--text-primary)',
        position: 'absolute',
        top: '2px',
        left: value ? '22px' : '2px',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
      }} />
    </button>
  </div>
);

// Input Field
const SettingInput: React.FC<{ label: string; value: string; onChange?: (v: string) => void; type?: string; hint?: string; readonly?: boolean }> = ({
  label, value, onChange, type = 'text', hint, readonly
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
    <input
      type={type}
      className="input-field"
      value={value}
      onChange={e => onChange && onChange(e.target.value)}
      readOnly={readonly}
      style={{ opacity: readonly ? 0.6 : 1 }}
    />
    {hint && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{hint}</span>}
  </div>
);

// Company Settings Panel
const CompanyPanel: React.FC = () => {
  const [companyName, setCompanyName] = useState('Nexorux LLC');
  const [domain, setDomain] = useState('nexorux.com');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('America/Montevideo');
  const [defaultCountry, setDefaultCountry] = useState('UY');
  const [tenantId, setTenantId] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<any>('/settings/company')
      .then(settings => {
        setCompanyName(settings.companyName);
        setDomain(settings.domain);
        setDefaultCurrency(settings.defaultCurrency);
        setDefaultCountry(settings.defaultCountry);
        setTimezone(settings.timezone);
        setTenantId(settings.tenantId);
      })
      .catch(err => setError(err.message || 'No se pudo cargar la configuración'));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await apiFetch('/settings/company', {
        method: 'PUT',
        body: JSON.stringify({ companyName, domain, defaultCurrency, defaultCountry, timezone })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    setCompanyName('Nexorux Technologies LLC');
    setDomain('nexorux');
    setDefaultCurrency('USD');
    setDefaultCountry('UY');
    setTimezone('America/Montevideo');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Configuración de Empresa & Tenant</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Datos maestros de la organización, idioma, moneda y entidad legal principal.</p>
      </div>

      <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <SettingInput label="Razón Social / Empresa" value={companyName} onChange={setCompanyName} />
          <SettingInput label="Dominio Tenant" value={domain} onChange={setDomain} hint="Usado para identificar el tenant en multi-tenant SaaS" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Moneda por Defecto</label>
            <select className="input-field" value={defaultCurrency} onChange={e => setDefaultCurrency(e.target.value)}>
              <option value="USD">USD — Dólar Estadounidense</option>
              <option value="UYU">UYU — Peso Uruguayo</option>
              <option value="ARS">ARS — Peso Argentino</option>
              <option value="BRL">BRL — Real Brasileño</option>
              <option value="EUR">EUR — Euro</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>País Principal</label>
            <select className="input-field" value={defaultCountry} onChange={e => setDefaultCountry(e.target.value)}>
              <option value="UY">🇺🇾 Uruguay</option>
              <option value="AR">🇦🇷 Argentina</option>
              <option value="BR">🇧🇷 Brasil</option>
              <option value="US">🇺🇸 Estados Unidos</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Zona Horaria</label>
            <select className="input-field" value={timezone} onChange={e => setTimezone(e.target.value)}>
              <option value="America/Montevideo">America/Montevideo (UTC-3)</option>
              <option value="America/Buenos_Aires">America/Buenos_Aires (UTC-3)</option>
              <option value="America/Sao_Paulo">America/Sao_Paulo (UTC-3)</option>
              <option value="America/New_York">America/New_York (UTC-5)</option>
            </select>
          </div>
          <SettingInput label="Tenant ID" value={tenantId} readonly hint="Identificador inmutable del tenant" />
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>Políticas de Recursos Humanos</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { label: 'Período de prueba obligatorio para nuevos ingresos (90 días)', defaultVal: true },
            { label: 'Aprobación doble para licencias mayores a 10 días hábiles', defaultVal: true },
            { label: 'Audit trail inmutable para todas las operaciones de nómina', defaultVal: true },
            { label: 'Notificación automática de contratos a vencer (45 días)', defaultVal: true },
            { label: 'Portal ESS habilitado para todos los empleados activos', defaultVal: true },
          ].map((item, i) => {
            const [val, setVal] = useState(item.defaultVal);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 4 ? '1px solid var(--border-subtle)' : 'none' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{item.label}</span>
                <Toggle value={val} onChange={setVal} />
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={handleSave} className="btn-primary">
          <Save size={14} />
          <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
        </button>
        <button onClick={handleRestoreDefaults} className="btn-secondary">
          <RotateCcw size={14} />
          <span>Restaurar Defaults</span>
        </button>
        {error && <span style={{ color: 'var(--accent-rose)', fontSize: '12px', alignSelf: 'center' }}>{error}</span>}
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-emerald)', fontSize: '13px' }}>
            <CheckCircle2 size={14} />
            <span>Configuración guardada exitosamente</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Users & Roles Panel
const UsersPanel: React.FC = () => {
  const roles = [
    { role: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Acceso total al sistema multi-tenant. Solo Nexorux LLC.', count: 1, color: 'var(--accent-rose)' },
    { role: 'TENANT_OWNER', label: 'Tenant Owner', desc: 'Propietario del tenant. Configuración total de la empresa.', count: 1, color: 'var(--accent-amber)' },
    { role: 'HR_ADMIN', label: 'HR Administrator', desc: 'Gestión completa de RRHH, nómina, onboarding y ATS.', count: 2, color: '#6366F1' },
    { role: 'PAYROLL_MANAGER', label: 'Payroll Manager', desc: 'Acceso exclusivo a liquidaciones y motores de país.', count: 1, color: '#8B5CF6' },
    { role: 'MANAGER', label: 'Manager / Líder de Equipo', desc: 'Vista de su equipo, aprobación de licencias, novedades.', count: 3, color: 'var(--accent-emerald)' },
    { role: 'RECRUITER', label: 'Recruiter / Talent Acquisition', desc: 'Acceso al ATS, candidatos y vacantes.', count: 1, color: '#38BDF8' },
    { role: 'EMPLOYEE', label: 'Employee (Portal ESS)', desc: 'Portal de autoservicio: fichaje, recibos, documentos.', count: 0, color: '#94A3B8' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Usuarios, Roles & Permisos RBAC</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Modelo de control de acceso basado en roles (RBAC) con principio de mínimo privilegio.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {roles.map((r, i) => (
          <div key={i} className="glass-panel" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: `4px solid ${r.color}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.label}</span>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: r.color, background: `${r.color}18`, padding: '2px 6px', borderRadius: '4px' }}>{r.role}</span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.desc}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{r.count}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>usuarios</div>
              </div>
              <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: '11px' }}>Editar</button>
            </div>
          </div>
        ))}
      </div>

      <button className="btn-primary" style={{ alignSelf: 'flex-start' }}>
        <Users size={14} />
        <span>Invitar Nuevo Usuario</span>
      </button>
    </div>
  );
};

// Security Panel
const SecurityPanel: React.FC = () => {
  const [mfa, setMfa] = useState(true);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('480');
  const [ipWhitelist, setIpWhitelist] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newApiKey, setNewApiKey] = useState('');

  useEffect(() => { apiFetch<any[]>('/settings/api-keys').then(setApiKeys).catch(() => setApiKeys([])); }, []);

  const generateApiKey = async (name: string) => {
    const result = await apiFetch<{ key: string }>('/settings/api-keys', { method: 'POST', body: JSON.stringify({ name }) });
    setNewApiKey(result.key);
    setApiKeys(await apiFetch<any[]>('/settings/api-keys'));
  };

  const revokeApiKey = async (id: string) => {
    await apiFetch(`/settings/api-keys/${id}`, { method: 'DELETE' });
    setApiKeys(await apiFetch<any[]>('/settings/api-keys'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Seguridad & Control de Acceso</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Políticas de autenticación, sesiones, SSO y API keys empresariales.</p>
      </div>

      <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Autenticación & Sesiones</h4>

        {[
          { label: 'Autenticación de Dos Factores (2FA/MFA) obligatorio', val: mfa, set: setMfa },
          { label: 'Single Sign-On (SSO) con Google Workspace / Azure AD', val: ssoEnabled, set: setSsoEnabled },
          { label: 'Whitelist de IPs para acceso de administradores', val: ipWhitelist, set: setIpWhitelist },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: i < 2 ? '14px' : 0, borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{item.label}</span>
            <Toggle value={item.val} onChange={item.set} />
          </div>
        ))}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Timeout de Sesión Inactiva (minutos)</label>
          <select className="input-field" value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)} style={{ maxWidth: '200px' }}>
            <option value="60">60 minutos</option>
            <option value="240">4 horas</option>
            <option value="480">8 horas (jornada laboral)</option>
            <option value="1440">24 horas</option>
          </select>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>API Keys & Acceso Programático</h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={14} color="var(--brand-primary)" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>API Key Principal (Production)</span>
                <span className="badge badge-success">ACTIVA</span>
              </div>
              <button onClick={() => setApiKeyVisible(!apiKeyVisible)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                {apiKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--brand-primary)', letterSpacing: '0.05em' }}>
              {apiKeys.length ? `${apiKeys[0].key_prefix}••••••••••••` : 'No hay API keys activas'}
            </div>
          </div>

          {newApiKey && <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--accent-amber)', fontSize: '11px', wordBreak: 'break-all' }}>Copia esta clave ahora: {newApiKey}</div>}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => generateApiKey('Production')} className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
              <RotateCcw size={12} />
              <span>Regenerar API Key</span>
            </button>
            <button onClick={() => generateApiKey('Sandbox')} className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
              <Key size={12} />
              <span>Nueva Clave Sandbox</span>
            </button>
          </div>
          {apiKeys.map(key => <div key={key.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}><span>{key.name} · {key.key_prefix}...</span><button onClick={() => revokeApiKey(key.id)} className="btn-danger" style={{ padding: '3px 8px', fontSize: '10px' }}>Revocar</button></div>)}
        </div>
      </div>

      <div style={{ padding: '14px 18px', background: 'rgba(239, 68, 68, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <AlertTriangle size={16} color="var(--accent-rose)" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--accent-rose)' }}>Zona de Peligro:</strong> La regeneración de API keys revocará todas las integraciones activas. Las credenciales del sistema de nómina, webhooks, y conectores externos deberán ser actualizados manualmente.
        </div>
      </div>
    </div>
  );
};

// Integrations Panel
const IntegrationsPanel: React.FC = () => {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [configValue, setConfigValue] = useState('');

  useEffect(() => {
    apiFetch<any[]>('/settings/integrations').then(setIntegrations).catch(err => setMessage(err.message));
  }, []);

  const saveIntegration = async (integration: any, connected: boolean) => {
    try {
      await apiFetch(`/settings/integrations/${encodeURIComponent(integration.provider)}`, {
        method: 'PUT',
        body: JSON.stringify({ ...integration, status: connected ? 'CONNECTED' : 'DISCONNECTED', config: connected ? { endpoint: configValue || 'configured' } : {} })
      });
      setIntegrations(items => items.map(item => item.provider === integration.provider ? { ...item, status: connected ? 'CONNECTED' : 'DISCONNECTED' } : item));
      setConfiguring(null);
      setMessage(`${integration.provider} guardada correctamente`);
    } catch (err: any) { setMessage(err.message); }
  };

  const testIntegration = async (integration: any) => {
    try {
      const result = await apiFetch<{ message: string }>(`/settings/integrations/${encodeURIComponent(integration.provider)}/test`, { method: 'POST' });
      setMessage(result.message);
      setIntegrations(items => items.map(item => item.provider === integration.provider ? { ...item, status: 'CONNECTED' } : item));
    } catch (err: any) { setMessage(err.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Integraciones & Ecosistema API</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Conecta Nexorux HR con otras plataformas a través de webhooks, REST API y conectores nativos.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {integrations.map((intg, i) => (
          <div key={i} className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '28px', lineHeight: 1 }}>{intg.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{intg.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: '4px' }}>{intg.category}</span>
                </div>
                  <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                    background: intg.status === 'CONNECTED' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
                    color: intg.status === 'CONNECTED' ? 'var(--accent-emerald)' : 'var(--text-muted)',
                }}>
                  {intg.status === 'CONNECTED' ? '● CONECTADO' : '○ DESCONECTADO'}
                </span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.4 }}>{intg.desc}</p>
              <button onClick={() => { setConfiguring(intg.provider); setConfigValue(''); }} className="btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}>
                {intg.status === 'CONNECTED' ? 'Configurar' : 'Conectar'}
              </button>
              {intg.status === 'CONNECTED' && <button onClick={() => testIntegration(intg)} className="btn-secondary" style={{ fontSize: '11px', padding: '4px 10px', marginLeft: '6px' }}>Probar</button>}
            </div>
            {configuring === intg.provider && <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}><input className="input-field" placeholder="Endpoint o identificador de conexión" value={configValue} onChange={event => setConfigValue(event.target.value)} /><button onClick={() => saveIntegration(intg, true)} className="btn-primary" style={{ fontSize: '11px' }}>Guardar</button></div>}
          </div>
        ))}
      </div>
      {message && <div className="glass-panel" style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '12px' }}>{message}</div>}

      <div className="glass-panel" style={{ padding: '18px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Webhook size={16} color="var(--brand-primary)" />
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Webhook Endpoints Configurados</h4>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { url: 'https://hooks.slack.com/services/T00/B00/nexorux-hr', event: 'PAYROLL_APPROVED', status: 'ACTIVO' },
            { url: 'https://api.zapier.com/v1/hooks/nexorux/employee-hired', event: 'EMPLOYEE_HIRED', status: 'ACTIVO' },
            { url: 'https://app.bamboohr.com/webhooks/nexorux/sync', event: 'ALL_EVENTS', status: 'PAUSADO' },
          ].map((wh, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '6px', fontSize: '12px' }}>
              <span className={`badge ${wh.status === 'ACTIVO' ? 'badge-success' : 'badge-warning'}`}>{wh.status}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wh.url}</span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{wh.event}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Notifications Panel
const NotificationsPanel: React.FC = () => {
  const [preferences, setPreferences] = useState<any[]>([]);
  const [saved, setSaved] = useState(false);
  useEffect(() => { apiFetch<any[]>('/settings/notifications').then(setPreferences).catch(() => setPreferences([])); }, []);
  const update = (eventKey: string, channel: string, value: boolean) => setPreferences(items => items.map(item => item.eventKey === eventKey ? { ...item, [channel]: value } : item));
  const save = async () => { await apiFetch('/settings/notifications', { method: 'PUT', body: JSON.stringify({ preferences }) }); setSaved(true); setTimeout(() => setSaved(false), 2500); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Preferencias de Notificaciones</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Configura qué eventos disparan notificaciones y por qué canales: email, Slack o push.</p>
      </div>

      <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>Eventos de notificación</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '8px 16px', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Evento</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Email</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Slack</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Push</div>

            {preferences.map((item, ii) => {
              return (
                <React.Fragment key={ii}>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', paddingTop: ii > 0 ? '8px' : 0, paddingBottom: '8px', borderTop: ii > 0 ? '1px solid var(--border-subtle)' : 'none' }}>{item.label}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: ii > 0 ? '8px' : 0 }}><Toggle value={item.email} onChange={value => update(item.eventKey, 'email', value)} /></div>
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: ii > 0 ? '8px' : 0 }}><Toggle value={item.slack} onChange={value => update(item.eventKey, 'slack', value)} /></div>
                  <div style={{ display: 'flex', justifyContent: 'center', paddingTop: ii > 0 ? '8px' : 0 }}><Toggle value={item.push} onChange={value => update(item.eventKey, 'push', value)} /></div>
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px', alignItems: 'center' }}><button onClick={save} className="btn-primary">Guardar preferencias</button>{saved && <span style={{ color: 'var(--accent-emerald)', fontSize: '12px' }}>Guardado</span>}</div>
        </div>
    </div>
  );
};

// Billing Panel
const BillingPanel: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <div>
      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Suscripción & Facturación</h3>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Plan actual, límites de uso, historial de facturación y gestión de pagos.</p>
    </div>

    <div className="glass-panel" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <span className="badge badge-purple" style={{ marginBottom: '8px', display: 'inline-block' }}>PLAN ENTERPRISE</span>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Nexorux HR Enterprise</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Multi-tenant · Motores de país UY/AR/BR/US · SLA 99.9%</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--brand-primary)' }}>$499</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ mes USD</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Empleados Activos', used: 8, limit: 500 },
          { label: 'Países Habilitados', used: 4, limit: 10 },
          { label: 'Usuarios del Sistema', used: 6, limit: 50 },
          { label: 'GB en Vault', used: 0.3, limit: 100 },
        ].map((item, i) => {
          const pct = (item.used / item.limit) * 100;
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{item.used}/{item.limit}</span>
              </div>
              <div style={{ height: '5px', background: 'var(--border-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? 'var(--accent-rose)' : 'var(--brand-primary)', borderRadius: '999px' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>

    <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
      <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>Historial de Facturación</h4>
      <table className="data-table" style={{ fontSize: '12px' }}>
        <thead>
          <tr>
            <th>Período</th><th>Monto</th><th>Estado</th><th>Factura</th>
          </tr>
        </thead>
        <tbody>
          {[
            { period: 'Septiembre 2026', amount: '$499.00', status: 'PAGADO' },
            { period: 'Agosto 2026', amount: '$499.00', status: 'PAGADO' },
            { period: 'Julio 2026', amount: '$499.00', status: 'PAGADO' },
          ].map((inv, i) => (
            <tr key={i}>
              <td>{inv.period}</td>
              <td style={{ fontWeight: 600 }}>{inv.amount}</td>
              <td><span className="badge badge-success">{inv.status}</span></td>
              <td>
                <button style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>
                  Descargar PDF
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Appearance Panel
interface AppearancePanelProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

const AppearancePanel: React.FC<AppearancePanelProps> = ({ theme, onToggleTheme }) => {
  const [density, setDensity] = useState<'compact' | 'default' | 'comfortable'>(() => (localStorage.getItem('nexorux-density') as 'compact' | 'default' | 'comfortable') || 'default');
  const [brandColor, setBrandColor] = useState('#6366F1');
  const [platformName, setPlatformName] = useState('Nexorux HR');
  const [savedBranding, setSavedBranding] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem('nexorux-density', density);
  }, [density]);

  useEffect(() => {
    apiFetch<any>('/settings/company').then(settings => {
      setBrandColor(settings.branding?.primaryColor || '#6366F1');
      setPlatformName(settings.branding?.platformName || 'Nexorux HR');
    }).catch(() => undefined);
  }, []);

  useEffect(() => { document.documentElement.style.setProperty('--brand-primary', brandColor); }, [brandColor]);

  const saveBranding = async () => {
    const current = await apiFetch<any>('/settings/company');
    await apiFetch('/settings/company', { method: 'PUT', body: JSON.stringify({
      companyName: current.companyName, domain: current.domain, defaultCurrency: current.defaultCurrency,
      defaultCountry: current.defaultCountry, timezone: current.timezone,
      branding: { ...(current.branding || {}), primaryColor: brandColor, platformName }
    }) });
    setSavedBranding(true);
    setTimeout(() => setSavedBranding(false), 2500);
  };

return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Apariencia & Personalización UI</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ajusta el tema, densidad de interfaz, idioma y marca corporativa.</p>
      </div>

      <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>Tema de Interfaz</h4>
        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { id: 'dark', label: 'Dark Mode', desc: 'Slate oscuro (Enterprise Default)', active: theme === 'dark' },
            { id: 'light', label: 'Corporate', desc: 'Tema claro para presentaciones', active: theme === 'light' },
          ].map((theme, i) => (
            <button key={i} onClick={theme.id === 'dark' && window.document.documentElement.dataset.theme === 'light' || theme.id === 'light' && window.document.documentElement.dataset.theme !== 'light' ? onToggleTheme : undefined} style={{ flex: 1, width: '100%', padding: '14px', textAlign: 'left', background: theme.active ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: `1px solid ${theme.active ? 'var(--brand-primary)' : 'var(--border-card)'}`, cursor: theme.active ? 'default' : 'pointer', color: 'inherit' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{theme.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{theme.desc}</div>
              {theme.active && <div style={{ marginTop: '8px' }}><span className="badge badge-purple">ACTIVO</span></div>}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>Densidad de Información</h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['compact', 'default', 'comfortable'] as const).map(d => (
            <button key={d} onClick={() => setDensity(d)} style={{ padding: '8px 16px', borderRadius: '8px', background: density === d ? 'var(--brand-primary)' : 'var(--bg-card)', color: density === d ? '#fff' : 'var(--text-secondary)', border: `1px solid ${density === d ? 'var(--brand-primary)' : 'var(--border-card)'}`, cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s', textTransform: 'capitalize' }}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>Branding Corporativo</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <SettingInput label="Color Principal de Marca" value={brandColor} onChange={setBrandColor} type="color" hint="Aplicado en botones, activos y acentos" />
          <SettingInput label="Nombre en Plataforma" value={platformName} onChange={setPlatformName} hint="Nombre visible en sidebar y login" />
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '14px' }}><button onClick={saveBranding} className="btn-primary">Guardar branding</button>{savedBranding && <span style={{ color: 'var(--accent-emerald)', fontSize: '12px' }}>Branding guardado</span>}</div>
        <div style={{ marginTop: '14px', padding: '12px', background: 'var(--bg-input)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          💡 La carga de logotipo corporativo y favicon requiere plan Enterprise con white-label habilitado.
        </div>
      </div>
    </div>
  );
};

// Main Settings View
export const SettingsView: React.FC<SettingsViewProps> = ({ activeRole, theme = 'dark', onToggleTheme = () => undefined }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');

  const renderPanel = () => {
    switch (activeTab) {
      case 'company': return <CompanyPanel />;
      case 'users': return <UsersPanel />;
      case 'notifications': return <NotificationsPanel />;
      case 'security': return <SecurityPanel />;
      case 'integrations': return <IntegrationsPanel />;
      case 'appearance': return <AppearancePanel theme={theme} onToggleTheme={onToggleTheme} />;
      case 'billing': return <BillingPanel />;
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '18px 24px', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Settings size={20} color="var(--brand-primary)" />
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Configuración del Sistema</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Administración de empresa, usuarios, seguridad, integraciones y facturación.</p>
        </div>
      </div>

      {/* Two-column Layout */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <SettingsSidebar active={activeTab} onSelect={setActiveTab} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {renderPanel()}
        </div>
      </div>
    </div>
  );
};
