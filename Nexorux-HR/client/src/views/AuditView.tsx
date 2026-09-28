import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, Filter, ShieldCheck, Terminal, Clock, RefreshCw } from 'lucide-react';
import { AuditLog } from '../types';
import { apiFetch } from '../api';

export const AuditView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<AuditLog[]>('/audit');
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const filteredLogs = logs.filter(l =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.user_email.toLowerCase().includes(search.toLowerCase()) ||
    l.resource_type.toLowerCase().includes(search.toLowerCase())
  );

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
        gap: '14px',
        background: 'var(--surface-gradient)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldAlert size={22} color="#818CF8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Registro de Auditoría & Trazabilidad</h2>
              <span className="badge badge-success">INMUTABLE</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Registro cronológico de todas las mutaciones críticas (salarios, estados, contratos, nómina y licencias).
            </p>
          </div>
        </div>

        <button onClick={loadAuditLogs} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} />
          <span>Actualizar Logs</span>
        </button>
      </div>

      {/* Filter */}
      <div className="glass-panel" style={{ padding: '14px 20px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Filtrar por acción (ej: SALARY_CHANGED), usuario o recurso..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '34px' }}
          />
        </div>
      </div>

      {/* Audit Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Usuario Actor</th>
              <th>Acción Realizada</th>
              <th>Recurso Afectado</th>
              <th>IP Origen</th>
              <th>Detalles / Delta del Cambio</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Leyendo registros criptográficos de auditoría...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No se encontraron registros de auditoría.
                </td>
              </tr>
            ) : (
              filteredLogs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--brand-primary)' }}>
                    {log.created_at}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.user_email || 'Sistema'}</div>
                  </td>
                  <td>
                    <span className={`badge ${
                      log.action.includes('SALARY')
                        ? 'badge-warning'
                        : log.action.includes('APPROVED')
                          ? 'badge-success'
                          : 'badge-purple'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{log.resource_type}</span>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ID: {log.resource_id.slice(0, 8)}...</div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {log.ip_address}
                  </td>
                  <td>
                    <div style={{
                      background: 'var(--bg-input)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      maxWidth: '380px',
                      overflowX: 'auto',
                      whiteSpace: 'nowrap'
                    }}>
                      {log.details_json}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
