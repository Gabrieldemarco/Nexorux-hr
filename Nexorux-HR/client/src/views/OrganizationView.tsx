import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Building2, 
  MapPin, 
  Layers, 
  Briefcase, 
  ChevronDown, 
  ChevronRight, 
  Users, 
  ExternalLink,
  Shield
} from 'lucide-react';
import { apiFetch } from '../api';

interface OrgNode {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  photo_url?: string;
  position_title: string;
  position_level: string;
  department_name: string;
  branch_city: string;
  subordinates: OrgNode[];
}

interface OrganizationViewProps {
  onSelectEmployeeId?: (id: string) => void;
}

export const OrganizationView: React.FC<OrganizationViewProps> = ({ onSelectEmployeeId }) => {
  const [activeTab, setActiveTab] = useState<'chart' | 'companies' | 'departments' | 'positions'>('chart');
  const [treeRoots, setTreeRoots] = useState<OrgNode[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrgData();
  }, []);

  const loadOrgData = async () => {
    setLoading(true);
    try {
      const [tree, comps, brs, depts, poss] = await Promise.all([
        apiFetch<OrgNode[]>('/org/tree'),
        apiFetch<any[]>('/org/companies'),
        apiFetch<any[]>('/org/branches'),
        apiFetch<any[]>('/org/departments'),
        apiFetch<any[]>('/org/positions')
      ]);
      setTreeRoots(tree);
      setCompanies(comps);
      setBranches(brs);
      setDepartments(depts);
      setPositions(poss);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Tabs */}
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
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Estructura Organizacional</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Jerarquías de reporte, empresas multi-país, sucursales y organigrama interactivo.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          {[
            { id: 'chart', label: 'Organigrama Visual', icon: Network },
            { id: 'companies', label: 'Empresas & Sucursales', icon: Building2 },
            { id: 'departments', label: 'Departamentos', icon: Layers },
            { id: 'positions', label: 'Puestos de Trabajo', icon: Briefcase },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: isActive ? 'var(--brand-primary)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. ORGANIGRAMA INTERACTIVO */}
      {activeTab === 'chart' && (
        <div className="glass-panel" style={{
          padding: '30px',
          borderRadius: 'var(--radius-lg)',
          overflowX: 'auto',
          minHeight: '600px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Generando organigrama jerárquico de la organización...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
              {treeRoots.map(root => (
                <TreeNodeItem key={root.id} node={root} onSelectEmployeeId={onSelectEmployeeId} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. EMPRESAS Y SUCURSALES */}
      {activeTab === 'companies' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {companies.map(c => {
            const companyBranches = branches.filter(b => b.company_id === c.id);
            return (
              <div key={c.id} className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={18} color="var(--brand-primary)" />
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</h3>
                  </div>
                  <span className="badge badge-purple">{c.country_code}</span>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  <div>RUT / Tax ID: <strong style={{ color: 'var(--text-primary)' }}>{c.tax_id}</strong></div>
                  <div>Sede Central: <strong style={{ color: 'var(--text-primary)' }}>{c.is_headquarters ? 'Sí (HQ Global)' : 'Filial'}</strong></div>
                  <div>Dirección Legal: {c.legal_address}</div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    SUCURSALES & CAMPUS ({companyBranches.length})
                  </div>
                  {companyBranches.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      <MapPin size={12} color="#10B981" />
                      <span>{b.name} ({b.city}) • TZ: {b.timezone}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. DEPARTAMENTOS */}
      {activeTab === 'departments' && (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre del Departamento</th>
                <th>Colaboradores Asignados</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(d => (
                <tr key={d.id}>
                  <td><span className="badge badge-purple">{d.code}</span></td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={14} color="var(--text-muted)" />
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.employee_count}</span> colaboradores
                    </div>
                  </td>
                  <td><span className="badge badge-success">ACTIVO</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. PUESTOS */}
      {activeTab === 'positions' && (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Título del Puesto</th>
                <th>Nivel</th>
                <th>Departamento</th>
                <th>Rango Salarial de Referencia</th>
                <th>Ocupantes</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.title}</td>
                  <td><span className="badge badge-info">{p.level}</span></td>
                  <td>{p.department_name}</td>
                  <td style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                    ${Number(p.min_salary).toLocaleString()} - ${Number(p.max_salary).toLocaleString()} USD
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.employee_count}</span> asignados
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Recursive Component for Tree Nodes
const TreeNodeItem: React.FC<{ node: OrgNode; onSelectEmployeeId?: (id: string) => void }> = ({
  node,
  onSelectEmployeeId
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasSubordinates = node.subordinates && node.subordinates.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Node Card */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 18px',
          borderRadius: 'var(--radius-md)',
          width: '260px',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-md)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s ease',
                      background: 'var(--bg-card)'
        }}
        onClick={() => onSelectEmployeeId && onSelectEmployeeId(node.id)}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--brand-primary)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border-card)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src={node.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
            alt={node.first_name}
            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--brand-primary)' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="truncate-text" style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
              {node.first_name} {node.last_name}
            </div>
            <div className="truncate-text" style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 600 }}>
              {node.position_title}
            </div>
            <div className="truncate-text" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {node.department_name} • {node.branch_city}
            </div>
          </div>
        </div>

        {hasSubordinates && (
          <div
            onClick={e => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            style={{
              position: 'absolute',
              bottom: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--brand-primary)',
              color: 'var(--text-primary)',
              borderRadius: '999px',
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              zIndex: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
            }}
          >
            <span>{node.subordinates.length}</span>
            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </div>
        )}
      </div>

      {/* Connecting vertical line */}
      {hasSubordinates && isExpanded && (
        <div style={{ width: '2px', height: '24px', background: 'var(--border-subtle)' }} />
      )}

      {/* Subordinates Row */}
      {hasSubordinates && isExpanded && (
        <div style={{
          display: 'flex',
          gap: '24px',
          position: 'relative',
          paddingTop: '12px'
        }}>
          {node.subordinates.map((sub, idx) => (
            <TreeNodeItem key={sub.id} node={sub} onSelectEmployeeId={onSelectEmployeeId} />
          ))}
        </div>
      )}
    </div>
  );
};
