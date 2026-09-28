import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus, 
  Download, 
  Eye, 
  Briefcase, 
  Calendar, 
  FileText, 
  DollarSign, 
  CheckSquare, 
  Clock, 
  X, 
  ShieldCheck, 
  AlertCircle,
  Building,
  Mail,
  Phone,
  CreditCard,
  Scale
} from 'lucide-react';
import { Employee, UserRole } from '../types';
import { apiFetch } from '../api';
import { downloadCsv } from '../utils/downloadCsv';
import { downloadPdf } from '../utils/exportPdf';
import { SkeletonTable } from '../components/SkeletonLoader';

interface EmployeesViewProps {
  activeRole: UserRole;
  selectedEmployeeId?: string | null;
  onClearSelectedEmployee?: () => void;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({
  activeRole,
  selectedEmployeeId,
  onClearSelectedEmployee
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Profile 360° Drawer State
  const [activeProfile, setActiveProfile] = useState<any | null>(null);
  const [profileTab, setProfileTab] = useState<'overview' | 'contract' | 'legal' | 'salary' | 'docs' | 'attendance' | 'onboarding'>('overview');
  const [profileLoading, setProfileLoading] = useState(false);

  // Add Employee Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_id: '',
    branch_id: '',
    department_id: '',
    position_id: '',
    manager_id: '',
    hire_date: new Date().toISOString().split('T')[0],
    contract_type: 'INDEFINITE',
    base_salary: 5000,
    currency: 'USD',
    national_id: '',
    tax_id: ''
  });

  const canViewSalaries = ['SUPER_ADMIN', 'TENANT_OWNER', 'HR_ADMIN', 'PAYROLL_MANAGER'].includes(activeRole);
  const canManageEmployees = ['SUPER_ADMIN', 'TENANT_OWNER', 'HR_ADMIN', 'HR_MANAGER'].includes(activeRole);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      let query = `/employees?`;
      if (search) query += `search=${encodeURIComponent(search)}&`;
      if (selectedDept) query += `departmentId=${selectedDept}&`;
      if (selectedStatus) query += `status=${selectedStatus}&`;

      const data = await apiFetch<Employee[]>(query);
      setEmployees(data);
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [depts, poss, comps, brs] = await Promise.all([
        apiFetch<any[]>('/org/departments'),
        apiFetch<any[]>('/org/positions'),
        apiFetch<any[]>('/org/companies'),
        apiFetch<any[]>('/org/branches')
      ]);
      setDepartments(depts);
      setPositions(poss);
      setCompanies(comps);
      setBranches(brs);

      if (comps.length > 0) {
        setFormData(prev => ({
          ...prev,
          company_id: comps[0].id,
          branch_id: brs[0]?.id || '',
          department_id: depts[0]?.id || '',
          position_id: poss[0]?.id || ''
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [search, selectedDept, selectedStatus]);

  useEffect(() => {
    if (selectedEmployeeId) {
      openProfile(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  const openProfile = async (id: string) => {
    setProfileLoading(true);
    try {
      const data = await apiFetch<any>(`/employees/${id}`);
      setActiveProfile(data);
      setProfileTab('overview');
    } catch (err) {
      console.error('Error opening profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setActiveProfile(null);
    if (onClearSelectedEmployee) {
      onClearSelectedEmployee();
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/employees', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      setIsCreateOpen(false);
      fetchEmployees();
    } catch (err: any) {
      alert(`Error al crear empleado: ${err.message}`);
    }
  };

  const openEditProfile = (employee: any) => {
    setActiveProfile(employee);
    setFormData({
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      company_id: employee.company_id || '',
      branch_id: employee.branch_id || '',
      department_id: employee.department_id || '',
      position_id: employee.position_id || '',
      manager_id: employee.manager_id || '',
      hire_date: employee.hire_date || new Date().toISOString().split('T')[0],
      contract_type: employee.contract_type || 'INDEFINITE',
      base_salary: Number(employee.base_salary) || 0,
      currency: employee.currency || 'USD',
      national_id: employee.national_id || '',
      tax_id: employee.tax_id || ''
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfile?.id) return;
    setSaving(true);
    setEditError('');
    try {
      await apiFetch(`/employees/${activeProfile.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      });
      setIsEditOpen(false);
      fetchEmployees();
      if (activeProfile) {
        openProfile(activeProfile.id);
      }
    } catch (err: any) {
      setEditError(err.message || 'No se pudo actualizar el empleado');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      await apiFetch(`/onboarding/${taskId}/toggle`, { method: 'PUT' });
      if (activeProfile) {
        openProfile(activeProfile.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const exportEmployees = () => {
    downloadCsv(`empleados-${new Date().toISOString().slice(0, 10)}.csv`, employees.map(employee => ({
      codigo: employee.employee_code,
      nombre: `${employee.first_name} ${employee.last_name}`,
      email: employee.email,
      puesto: employee.position_title,
      departamento: employee.department_name,
      sucursal: employee.branch_name,
      estado: employee.employment_status,
      salario: employee.base_salary,
      moneda: employee.currency
    })));
  };

  const exportEmployeesPdf = () => downloadPdf(`empleados-${new Date().toISOString().slice(0, 10)}.pdf`, 'Directorio de Empleados Nexorux HR', employees.map(employee => ({
    codigo: employee.employee_code,
    nombre: `${employee.first_name} ${employee.last_name}`,
    puesto: employee.position_title,
    departamento: employee.department_name,
    estado: employee.employment_status
  })));

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Action and Filter Bar */}
      <div className="glass-panel" style={{
        padding: '16px 20px',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Search & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '320px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Buscar por nombre, código EMP, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '34px' }}
            />
          </div>

          <select
            className="input-field"
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="">Todos los departamentos</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            className="input-field"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            style={{ width: '140px' }}
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activo</option>
            <option value="PROBATION">Período de prueba</option>
            <option value="TERMINATED">Baja / Desvinculado</option>
          </select>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={exportEmployees}
            className="btn-secondary"
          >
            <Download size={14} />
            <span>Exportar</span>
          </button>
          <button onClick={exportEmployeesPdf} className="btn-secondary">
            <FileText size={14} />
            <span>PDF</span>
          </button>

          {canManageEmployees && (
            <button onClick={() => setIsCreateOpen(true)} className="btn-primary">
              <UserPlus size={14} />
              <span>Nuevo Empleado</span>
            </button>
          )}
        </div>
      </div>

      {/* Employees Data Table */}
      <div className="responsive-table-container">
        <table className="responsive-table responsive-table-stack">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Puesto & Nivel</th>
              <th>Departamento</th>
              <th>Sucursal / País</th>
              <th>Ingreso</th>
              <th>Estado</th>
              {canViewSalaries && <th>Salario Base</th>}
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canViewSalaries ? 8 : 7} style={{ padding: 0 }}>
                  <SkeletonTable rows={5} columns={canViewSalaries ? 8 : 7} />
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={canViewSalaries ? 8 : 7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No se encontraron empleados con los filtros aplicados.
                </td>
              </tr>
            ) : (
              employees.map(emp => (
                <tr key={emp.id} style={{ cursor: 'pointer' }} onClick={() => openProfile(emp.id)}>
                  <td data-label="Colaborador">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src={emp.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                        alt={emp.first_name}
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {emp.first_name} {emp.last_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {emp.employee_code} • {emp.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Puesto & Nivel">
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{emp.position_title}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{emp.position_level}</div>
                  </td>
                  <td data-label="Departamento">{emp.department_name}</td>
                  <td data-label="Sucursal / País">{emp.branch_name || 'Montevideo HQ'}</td>
                  <td data-label="Ingreso">{emp.hire_date}</td>
                  <td data-label="Estado">
                    <span className={`badge ${
                      emp.employment_status === 'ACTIVE'
                        ? 'badge-success'
                        : emp.employment_status === 'PROBATION'
                          ? 'badge-warning'
                          : 'badge-danger'
                    }`}>
                      {emp.employment_status === 'PROBATION' ? 'Prueba' : emp.employment_status}
                    </span>
                  </td>
                  {canViewSalaries && (
                    <td data-label="Salario Base" style={{ fontWeight: 600, color: 'var(--accent-emerald)' }}>
                      ${Number(emp.base_salary).toLocaleString()} {emp.currency}
                    </td>
                  )}
                  <td data-label="Acciones" style={{ textAlign: 'right' }}>
                    <button
                      onClick={e => { e.stopPropagation(); openProfile(emp.id); }}
                      className="btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '11px' }}
                    >
                      <Eye size={12} />
                      <span>Ficha 360°</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ================= EMPLOYEE 360° PROFILE DRAWER ================= */}
      {activeProfile && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 7, 18, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 80,
          display: 'flex',
          justifyContent: 'flex-end'
        }} onClick={closeProfile}>
          <div
            className="glass-modal animate-fade-in"
            style={{
              width: '740px',
              height: '100vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{
              padding: '24px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              background: 'var(--surface-gradient)'
            }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <img
                  src={activeProfile.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160'}
                  alt={activeProfile.first_name}
                  style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'cover', border: '2px solid var(--border-card)' }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {activeProfile.first_name} {activeProfile.last_name}
                    </h2>
                    <span className="badge badge-purple">{activeProfile.employee_code}</span>
                    <span className="badge badge-success">{activeProfile.employment_status}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--brand-primary)', fontWeight: 600, marginTop: '2px' }}>
                    {activeProfile.position_title} ({activeProfile.position_level})
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {activeProfile.department_name} • {activeProfile.company_name} ({activeProfile.company_country || 'UY'})
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => openEditProfile(activeProfile)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} title="Editar empleado">
                  ✏️
                </button>
                <button onClick={closeProfile} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Profile Navigation Tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-subtle)',
              padding: '0 24px',
              background: 'var(--bg-card)',
              overflowX: 'auto'
            }}>
              {[
                { id: 'overview', label: 'Resumen', icon: Users },
                { id: 'contract', label: 'Relación Laboral', icon: Briefcase },
                { id: 'legal', label: 'Motor País & Vacaciones', icon: Scale },
                ...(canViewSalaries ? [{ id: 'salary', label: 'Historial Salarial', icon: DollarSign }] : []),
                { id: 'docs', label: 'Documentos', icon: FileText },
                { id: 'attendance', label: 'Asistencia', icon: Clock },
                { id: 'onboarding', label: 'Onboarding Checklist', icon: CheckSquare }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = profileTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setProfileTab(tab.id as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '12px 14px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: isActive ? '2px solid var(--brand-primary)' : '2px solid transparent',
                      color: isActive ? '#A5B4FC' : 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 1. OVERVIEW */}
              {profileTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="glass-panel" style={{ padding: '14px', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Email Corporativo</div>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>{activeProfile.email}</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '14px', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Teléfono Directo</div>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>{activeProfile.phone || 'No registrado'}</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '14px', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Documento de Identidad</div>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>{activeProfile.national_id}</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '14px', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Identificación Fiscal (RUT / CUIT / SSN)</div>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>{activeProfile.tax_id}</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '14px', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fecha de Nacimiento</div>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>{activeProfile.birth_date}</div>
                    </div>
                    <div className="glass-panel" style={{ padding: '14px', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Supervisor / Manager Directo</div>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '4px' }}>{activeProfile.manager_name || 'Sin supervisor asignado'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. CONTRACT */}
              {profileTab === 'contract' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="glass-panel" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>Contrato Vigente</h4>
                    {activeProfile.contracts && activeProfile.contracts.length > 0 ? (
                      activeProfile.contracts.map((c: any, i: number) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '12px' }}>
                          <div><span style={{ color: 'var(--text-muted)' }}>N° Contrato:</span> <strong style={{ color: 'var(--text-primary)' }}>{c.contract_number}</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>Tipo:</span> <strong style={{ color: 'var(--text-primary)' }}>{c.type}</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>Jornada:</span> <strong style={{ color: 'var(--text-primary)' }}>{c.work_hours_per_week}h / sem</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>Fecha Inicio:</span> <strong style={{ color: 'var(--text-primary)' }}>{c.start_date}</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>Vencimiento:</span> <strong style={{ color: 'var(--text-primary)' }}>{c.end_date || 'Indefinido'}</strong></div>
                          <div><span style={{ color: 'var(--text-muted)' }}>Fin Prueba:</span> <strong style={{ color: 'var(--accent-amber)' }}>{c.probation_end_date || 'Completado'}</strong></div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No hay registros de contratos asociados.</div>
                    )}
                  </div>
                </div>
              )}

              {/* 3. LEGAL & COUNTRY ENGINE CALCULATION */}
              {profileTab === 'legal' && activeProfile.legalEntitlement && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="glass-panel" style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    background: 'rgba(99, 102, 241, 0.05)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <Scale size={18} color="#818CF8" />
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Cálculo Estatutario de Vacaciones y Plus Legal ({activeProfile.company_country || 'UY'})
                      </h4>
                    </div>

                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      Base Legal: <strong style={{ color: 'var(--brand-primary)' }}>{activeProfile.legalEntitlement.legalBasis}</strong>
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Días Anuales Base</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{activeProfile.legalEntitlement.annualVacationDays} días</div>
                      </div>
                      <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Plus por Antigüedad</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-amber)' }}>+{activeProfile.legalEntitlement.seniorityBonusDays} días</div>
                      </div>
                      <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Días de Licencia</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-emerald)' }}>{activeProfile.legalEntitlement.totalEntitledDays} días</div>
                      </div>
                    </div>

                    {activeProfile.legalEntitlement.estimatedVacationBonus > 0 && (
                      <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--accent-emerald)', fontWeight: 600 }}>Salario Vacacional Proyectado (Líquido legal a pagar previo a licencia):</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                          ${activeProfile.legalEntitlement.estimatedVacationBonus.toLocaleString()} {activeProfile.legalEntitlement.currency}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. SALARY HISTORY */}
              {profileTab === 'salary' && canViewSalaries && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Historial y Trazabilidad de Compensación</h4>
                    <span className="badge badge-info">Auditoría Inmutable</span>
                  </div>

                  <div className="glass-panel" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Fecha Efectiva</th>
                          <th>Salario Anterior</th>
                          <th>Nuevo Salario</th>
                          <th>Moneda</th>
                          <th>Motivo del Ajuste</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeProfile.salaryHistories && activeProfile.salaryHistories.length > 0 ? (
                          activeProfile.salaryHistories.map((h: any, i: number) => (
                            <tr key={i}>
                              <td>{h.effective_date.split(' ')[0]}</td>
                              <td style={{ color: 'var(--text-muted)' }}>${Number(h.previous_salary).toLocaleString()}</td>
                              <td style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>${Number(h.new_salary).toLocaleString()}</td>
                              <td>{h.currency}</td>
                              <td>{h.reason}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td>{activeProfile.hire_date}</td>
                            <td style={{ color: 'var(--text-muted)' }}>$0</td>
                            <td style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>${Number(activeProfile.base_salary).toLocaleString()}</td>
                            <td>{activeProfile.currency}</td>
                            <td>Salario de contratación inicial</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isEditOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.75)', backdropFilter: 'blur(8px)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsEditOpen(false)}>
          <div className="glass-modal animate-fade-in" style={{ width: '640px', borderRadius: 'var(--radius-lg)', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>??</span>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Editar Colaborador</h3>
              </div>
              <button onClick={() => setIsEditOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nombres *</label><input type="text" required className="input-field" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} /></div>
                <div><label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Apellidos *</label><input type="text" required className="input-field" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email Corporativo *</label><input type="email" required className="input-field" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                <div><label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tel�fono M�vil</label><input type="text" className="input-field" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Empresa</label><select className="input-field" value={formData.company_id} onChange={e => setFormData({ ...formData, company_id: e.target.value })}>{companies.map(c => (<option key={c.id} value={c.id}>{c.name} ({c.country_code})</option>))}</select></div>
                <div><label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Sucursal</label><select className="input-field" value={formData.branch_id} onChange={e => setFormData({ ...formData, branch_id: e.target.value })}>{branches.map(b => (<option key={b.id} value={b.id}>{b.name}</option>))}</select></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Departamento</label><select className="input-field" value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })}>{departments.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}</select></div>
                <div><label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Puesto</label><select className="input-field" value={formData.position_id} onChange={e => setFormData({ ...formData, position_id: e.target.value })}>{positions.map(p => (<option key={p.id} value={p.id}>{p.title}</option>))}</select></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tipo de Contrato</label><select className="input-field" value={formData.contract_type} onChange={e => setFormData({ ...formData, contract_type: e.target.value })}><option value="INDEFINITE">Indefinido</option><option value="TEMPORARY">Temporal</option><option value="INTERNSHIP">Pasant�a</option><option value="CONTRACTOR">Contratista</option></select></div>
                <div><label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Fecha de Ingreso</label><input type="date" className="input-field" value={formData.hire_date} onChange={e => setFormData({ ...formData, hire_date: e.target.value })} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Salario Base Mensual</label><input type="number" className="input-field" value={formData.base_salary} onChange={e => setFormData({ ...formData, base_salary: Number(e.target.value) })} /></div>
                <div><label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Moneda</label><select className="input-field" value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })}><option value="USD">USD</option><option value="UYU">UYU</option><option value="ARS">ARS</option><option value="BRL">BRL</option></select></div>
              </div>
              {editError && <div role="alert" style={{ color: '#FB7185', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 'var(--radius-md)', padding: '10px', fontSize: '12px' }}>{editError}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsEditOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar Cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ================= CREATE EMPLOYEE MODAL ================= */}
      {isCreateOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 7, 18, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }} onClick={() => setIsCreateOpen(false)}>
          <div
            className="glass-modal animate-fade-in"
            style={{
              width: '640px',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserPlus size={20} color="var(--brand-primary)" />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Alta de Nuevo Colaborador</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nombres *</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Apellidos *</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    value={formData.last_name}
                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email Corporativo *</label>
                  <input
                    type="email"
                    required
                    className="input-field"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Teléfono Móvil</label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Empresa</label>
                  <select
                    className="input-field"
                    value={formData.company_id}
                    onChange={e => setFormData({ ...formData, company_id: e.target.value })}
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.country_code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Sucursal</label>
                  <select
                    className="input-field"
                    value={formData.branch_id}
                    onChange={e => setFormData({ ...formData, branch_id: e.target.value })}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Departamento</label>
                  <select
                    className="input-field"
                    value={formData.department_id}
                    onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Puesto Asignado</label>
                  <select
                    className="input-field"
                    value={formData.position_id}
                    onChange={e => setFormData({ ...formData, position_id: e.target.value })}
                  >
                    {positions.map(p => (
                      <option key={p.id} value={p.id}>{p.title} ({p.level})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Fecha de Ingreso</label>
                  <input
                    type="date"
                    className="input-field"
                    value={formData.hire_date}
                    onChange={e => setFormData({ ...formData, hire_date: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Salario Base Mensual</label>
                  <input
                    type="number"
                    className="input-field"
                    value={formData.base_salary}
                    onChange={e => setFormData({ ...formData, base_salary: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Moneda</label>
                  <select
                    className="input-field"
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                  >
                    <option value="USD">USD</option>
                    <option value="UYU">UYU</option>
                    <option value="ARS">ARS</option>
                    <option value="BRL">BRL</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Crear Colaborador & Disparar Onboarding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
