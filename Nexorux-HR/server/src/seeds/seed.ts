import { db, initDatabase } from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

export function seedDatabase() {
  initDatabase();

  const existingTenant = db.prepare('SELECT id FROM tenants LIMIT 1').get();
  if (existingTenant) {
    ensureRecruitmentCostSeedData((existingTenant as { id: string }).id);
    console.log('Database already initialized and seeded.');
    return;
  }

  console.log('Seeding Nexorux HR Enterprise multi-tenant data...');

  const tenantId = uuidv4();
  const passwordHash = bcrypt.hashSync('Nexorux2026!', 8);

  // 1. Tenant
  db.prepare(`
    INSERT INTO tenants (id, slug, legal_name, country_code, currency, timezone, is_active, branding_json, allowed_origins, created_at)
    VALUES (?, 'nexorux', 'Nexorux Technologies LLC', 'UY', 'USD', 'America/Montevideo', 1, ?, '*', datetime('now'))
  `).run(
    tenantId,
    JSON.stringify({
      primaryColor: '#6366F1',
      accentColor: '#10B981',
      companyName: 'Nexorux Global'
    })
  );

  // 2. Companies
  const compUY = uuidv4();
  const compAR = uuidv4();
  const compBR = uuidv4();
  const compUS = uuidv4();

  db.prepare(`
    INSERT INTO companies (id, tenant_id, name, tax_id, country_code, legal_address, is_headquarters) VALUES
    (?, ?, 'Nexorux Software S.A. (HQ)', '218899440019', 'UY', 'Dr. Luis Bonavita 1294, WTC Torre 4, Montevideo', 1),
    (?, ?, 'Nexorux Argentina S.R.L.', '30-71629481-9', 'AR', 'Juana Manso 1750, Puerto Madero, CABA', 0),
    (?, ?, 'Nexorux Brasil Tecnologia Ltda.', '41.298.112/0001-85', 'BR', 'Av. Paulista 1374, Bela Vista, São Paulo', 0),
    (?, ?, 'Nexorux USA Inc.', '88-4920194', 'US', '1111 Brickell Ave, Suite 2100, Miami, FL', 0)
  `).run(compUY, tenantId, compAR, tenantId, compBR, tenantId, compUS, tenantId);

  // 3. Branches
  const branchMVD = uuidv4();
  const branchBUE = uuidv4();
  const branchSAO = uuidv4();
  const branchMIA = uuidv4();

  db.prepare(`
    INSERT INTO branches (id, tenant_id, company_id, name, city, address, timezone) VALUES
    (?, ?, ?, 'WTC Montevideo Campus', 'Montevideo', 'WTC Free Zone Torre 4, Piso 18', 'America/Montevideo'),
    (?, ?, ?, 'Puerto Madero Hub', 'Buenos Aires', 'Juana Manso 1750, Piso 5', 'America/Argentina/Buenos_Aires'),
    (?, ?, ?, 'Paulista Innovation Center', 'São Paulo', 'Av. Paulista 1374, 12º andar', 'America/Sao_Paulo'),
    (?, ?, ?, 'Miami Americas HQ', 'Miami', '1111 Brickell Ave, 21st Floor', 'America/New_York')
  `).run(
    branchMVD, tenantId, compUY,
    branchBUE, tenantId, compAR,
    branchSAO, tenantId, compBR,
    branchMIA, tenantId, compUS
  );

  // 4. Departments
  const deptEng = uuidv4();
  const deptPrd = uuidv4();
  const deptPeople = uuidv4();
  const deptSales = uuidv4();
  const deptFin = uuidv4();

  db.prepare(`
    INSERT INTO departments (id, tenant_id, company_id, name, code) VALUES
    (?, ?, ?, 'Ingeniería y Tecnología', 'ENG'),
    (?, ?, ?, 'Producto & UX Design', 'PRD'),
    (?, ?, ?, 'People & Human Resources', 'PEOPLE'),
    (?, ?, ?, 'Comercial & Revenue', 'REV'),
    (?, ?, ?, 'Finanzas & Legal', 'FIN')
  `).run(
    deptEng, tenantId, compUY,
    deptPrd, tenantId, compUY,
    deptPeople, tenantId, compUY,
    deptSales, tenantId, compUY,
    deptFin, tenantId, compUY
  );

  // 5. Positions
  const posCTO = uuidv4();
  const posStaffAI = uuidv4();
  const posSrFullstack = uuidv4();
  const posHeadPeople = uuidv4();
  const posHRPatner = uuidv4();
  const posLeadUX = uuidv4();
  const posPayrollMgr = uuidv4();
  const posAccountExec = uuidv4();

  db.prepare(`
    INSERT INTO positions (id, tenant_id, title, department_id, level, min_salary, max_salary, description) VALUES
    (?, ?, 'Chief Technology Officer (CTO)', ?, 'EXECUTIVE', 8000, 12000, 'Liderazgo tecnológico global de la suite Nexorux'),
    (?, ?, 'Staff AI & Systems Architect', ?, 'LEAD', 6500, 9500, 'Investigación y despliegue de modelos de Nexorux IA'),
    (?, ?, 'Senior Full-Stack Engineer', ?, 'SENIOR', 4500, 6500, 'Desarrollo del HR Core y arquitectura multi-tenant'),
    (?, ?, 'Head of People & Culture', ?, 'EXECUTIVE', 5000, 7500, 'Estrategia de talento y retención internacional'),
    (?, ?, 'HR Business Partner', ?, 'MID', 2500, 3800, 'Acompañamiento a managers y procesos de clima laboral'),
    (?, ?, 'Lead UX/UI Product Designer', ?, 'SENIOR', 4000, 5800, 'Diseño de interfaces enterprise y Design System'),
    (?, ?, 'Payroll & Compliance Specialist', ?, 'MID', 2800, 4200, 'Gestión de nómina y compliance laboral multijurisdiccional'),
    (?, ?, 'Enterprise Account Executive', ?, 'SENIOR', 3500, 7000, 'Expansión comercial B2B en LATAM y US')
  `).run(
    posCTO, tenantId, deptEng,
    posStaffAI, tenantId, deptEng,
    posSrFullstack, tenantId, deptEng,
    posHeadPeople, tenantId, deptPeople,
    posHRPatner, tenantId, deptPeople,
    posLeadUX, tenantId, deptPrd,
    posPayrollMgr, tenantId, deptFin,
    posAccountExec, tenantId, deptSales
  );

  // 6. Employees
  const empCTO = uuidv4();
  const empStaffAI = uuidv4();
  const empSrEng = uuidv4();
  const empHeadHR = uuidv4();
  const empHRPartner = uuidv4();
  const empLeadUX = uuidv4();
  const empPayroll = uuidv4();
  const empSales = uuidv4();

  const employees = [
    {
      id: empCTO,
      code: 'EMP-1001',
      first: 'Agustín',
      last: 'Rodríguez',
      email: 'agustin.rodriguez@nexorux.com',
      phone: '+598 99 123 456',
      gender: 'MALE',
      birth: '1986-04-12',
      nationalId: '4.182.991-4',
      taxId: '218899440019',
      hire: '2021-02-01',
      comp: compUY,
      branch: branchMVD,
      dept: deptEng,
      pos: posCTO,
      manager: null,
      salary: 9500,
      currency: 'USD',
      status: 'ACTIVE',
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: empHeadHR,
      code: 'EMP-1002',
      first: 'Valeria',
      last: 'Méndez',
      email: 'valeria.mendez@nexorux.com',
      phone: '+598 98 456 789',
      gender: 'FEMALE',
      birth: '1989-08-23',
      nationalId: '4.551.203-8',
      taxId: '218899440019',
      hire: '2022-03-15',
      comp: compUY,
      branch: branchMVD,
      dept: deptPeople,
      pos: posHeadPeople,
      manager: null,
      salary: 6200,
      currency: 'USD',
      status: 'ACTIVE',
      photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: empLeadUX,
      code: 'EMP-1003',
      first: 'Camila',
      last: 'Soria',
      email: 'camila.soria@nexorux.com',
      phone: '+54 11 5821 4492',
      gender: 'FEMALE',
      birth: '1992-11-05',
      nationalId: '36.994.120',
      taxId: '27-36994120-4',
      hire: '2022-09-01',
      comp: compAR,
      branch: branchBUE,
      dept: deptPrd,
      pos: posLeadUX,
      manager: empCTO,
      salary: 5200,
      currency: 'USD',
      status: 'ACTIVE',
      photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: empStaffAI,
      code: 'EMP-1004',
      first: 'Thiago',
      last: 'Oliveira',
      email: 'thiago.oliveira@nexorux.com',
      phone: '+55 11 98412 0031',
      gender: 'MALE',
      birth: '1990-06-18',
      nationalId: '381.992.104-22',
      taxId: '38199210422',
      hire: '2023-01-10',
      comp: compBR,
      branch: branchSAO,
      dept: deptEng,
      pos: posStaffAI,
      manager: empCTO,
      salary: 7800,
      currency: 'USD',
      status: 'ACTIVE',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: empSrEng,
      code: 'EMP-1005',
      first: 'Martín',
      last: 'Alonso',
      email: 'martin.alonso@nexorux.com',
      phone: '+598 94 881 229',
      gender: 'MALE',
      birth: '1994-02-28',
      nationalId: '4.891.002-3',
      taxId: '218899440019',
      hire: '2023-05-15',
      comp: compUY,
      branch: branchMVD,
      dept: deptEng,
      pos: posSrFullstack,
      manager: empCTO,
      salary: 5000,
      currency: 'USD',
      status: 'ACTIVE',
      photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: empHRPartner,
      code: 'EMP-1006',
      first: 'Sofía',
      last: 'Laprida',
      email: 'sofia.laprida@nexorux.com',
      phone: '+598 91 332 990',
      gender: 'FEMALE',
      birth: '1995-10-14',
      nationalId: '5.102.884-1',
      taxId: '218899440019',
      hire: '2024-01-15',
      comp: compUY,
      branch: branchMVD,
      dept: deptPeople,
      pos: posHRPatner,
      manager: empHeadHR,
      salary: 3200,
      currency: 'USD',
      status: 'ACTIVE',
      photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: empPayroll,
      code: 'EMP-1007',
      first: 'Gonzalo',
      last: 'Peralta',
      email: 'gonzalo.peralta@nexorux.com',
      phone: '+54 11 4019 8221',
      gender: 'MALE',
      birth: '1991-07-09',
      nationalId: '35.402.190',
      taxId: '20-35402190-8',
      hire: '2023-11-01',
      comp: compAR,
      branch: branchBUE,
      dept: deptFin,
      pos: posPayrollMgr,
      manager: empHeadHR,
      salary: 3600,
      currency: 'USD',
      status: 'ACTIVE',
      photo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80'
    },
    {
      id: empSales,
      code: 'EMP-1008',
      first: 'Michael',
      last: 'Jenkins',
      email: 'michael.jenkins@nexorux.com',
      phone: '+1 305 555 0198',
      gender: 'MALE',
      birth: '1988-12-03',
      nationalId: '982-11-4029',
      taxId: '982-11-4029',
      hire: '2024-04-01',
      comp: compUS,
      branch: branchMIA,
      dept: deptSales,
      pos: posAccountExec,
      manager: null,
      salary: 5800,
      currency: 'USD',
      status: 'PROBATION',
      photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80'
    }
  ];

  const insertEmp = db.prepare(`
    INSERT INTO employees (
      id, tenant_id, company_id, branch_id, department_id, position_id, manager_id,
      employee_code, first_name, last_name, email, phone, gender, birth_date,
      national_id, tax_id, hire_date, employment_status, contract_type, base_salary,
      currency, photo_url, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, 'INDEFINITE', ?,
      ?, ?, datetime('now'), datetime('now')
    )
  `);

  const insertContract = db.prepare(`
    INSERT INTO contracts (
      id, tenant_id, employee_id, contract_number, type, start_date, end_date, probation_end_date, base_salary, currency, work_hours_per_week, status
    ) VALUES (?, ?, ?, ?, 'INDEFINITE', ?, ?, ?, ?, ?, 40, 'ACTIVE')
  `);

  const insertBalance = db.prepare(`
    INSERT INTO leave_balances (
      id, tenant_id, employee_id, year, allocated_days, used_days, pending_days, remaining_days
    ) VALUES (?, ?, ?, 2026, 20, ?, ?, ?)
  `);

  for (const e of employees) {
    insertEmp.run(
      e.id, tenantId, e.comp, e.branch, e.dept, e.pos, e.manager,
      e.code, e.first, e.last, e.email, e.phone, e.gender, e.birth,
      e.nationalId, e.taxId, e.hire, e.status, e.salary, e.currency, e.photo
    );

    const probationEnd = e.status === 'PROBATION' ? '2026-10-01' : null;
    const contractEnd = e.status === 'PROBATION' ? '2026-12-31' : null;

    insertContract.run(
      uuidv4(), tenantId, e.id, `CTR-${e.code}`, e.hire, contractEnd, probationEnd, e.salary, e.currency
    );

    const used = Math.floor(Math.random() * 5);
    const pending = Math.floor(Math.random() * 3);
    insertBalance.run(uuidv4(), tenantId, e.id, used, pending, 20 - used - pending);
  }

  // 7. Users with RBAC roles
  const users = [
    { email: 'admin@nexorux.com', first: 'Admin', last: 'Nexorux', role: 'TENANT_OWNER', empId: empCTO },
    { email: 'hr@nexorux.com', first: 'Valeria', last: 'Méndez', role: 'HR_ADMIN', empId: empHeadHR },
    { email: 'manager@nexorux.com', first: 'Agustín', last: 'Rodríguez', role: 'MANAGER', empId: empCTO },
    { email: 'recruiter@nexorux.com', first: 'Sofía', last: 'Laprida', role: 'RECRUITER', empId: empHRPartner },
    { email: 'payroll@nexorux.com', first: 'Gonzalo', last: 'Peralta', role: 'PAYROLL_MANAGER', empId: empPayroll },
    { email: 'employee@nexorux.com', first: 'Martín', last: 'Alonso', role: 'EMPLOYEE', empId: empSrEng },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, employee_id, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now'))
  `);

  for (const u of users) {
    insertUser.run(uuidv4(), tenantId, u.email, passwordHash, u.first, u.last, u.role, u.empId);
  }

  // 8. Attendances (Today and past few days)
  const today = new Date().toISOString().split('T')[0];
  const insertAtt = db.prepare(`
    INSERT INTO attendances (id, tenant_id, employee_id, date, clock_in, clock_out, break_minutes, regular_hours, overtime_hours, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  employees.forEach((emp, idx) => {
    // Today
    const status = idx === 1 ? 'LATE' : idx === 6 ? 'ON_LEAVE' : 'PRESENT';
    const clockIn = status === 'LATE' ? '09:28:10' : status === 'ON_LEAVE' ? null : '08:55:20';
    const clockOut = status === 'ON_LEAVE' ? null : '18:05:00';
    insertAtt.run(
      uuidv4(), tenantId, emp.id, today, clockIn, clockOut, 60, status === 'ON_LEAVE' ? 0 : 8, idx === 0 ? 1.5 : 0, status,
      status === 'LATE' ? 'Demora en tránsito' : null
    );
  });

  // 9. Leave Requests
  const insertLeave = db.prepare(`
    INSERT INTO leave_requests (id, tenant_id, employee_id, leave_type, start_date, end_date, days_count, status, reason, approver_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))
  `);

  insertLeave.run(uuidv4(), tenantId, empSrEng, 'VACATION', '2026-09-15', '2026-09-22', 7, 'PENDING', 'Vacaciones familiares anuales', null);
  insertLeave.run(uuidv4(), tenantId, empLeadUX, 'STUDY', '2026-09-10', '2026-09-11', 2, 'PENDING', 'Examen final de certificación UX Research', null);
  insertLeave.run(uuidv4(), tenantId, empPayroll, 'VACATION', '2026-08-01', '2026-08-10', 10, 'APPROVED', 'Licencia reglamentaria de invierno', empHeadHR);
  insertLeave.run(uuidv4(), tenantId, empSales, 'MEDICAL', '2026-08-20', '2026-08-21', 2, 'APPROVED', 'Certificado médico por odontología', empHeadHR);

  // 10. Job Openings & Candidates (ATS)
  const job1 = uuidv4();
  const job2 = uuidv4();
  const job3 = uuidv4();

  db.prepare(`
    INSERT INTO job_openings (id, tenant_id, company_id, department_id, position_id, title, description, requirements, openings_count, status) VALUES
    (?, ?, ?, ?, ?, 'Staff Backend Architect (Node/Go/K8s)', 'Buscamos un arquitecto backend para escalar la infraestructura multi-tenant de Nexorux', '8+ años exp, microservicios, TypeScript, Postgres, Kubernetes', 2, 'OPEN'),
    (?, ?, ?, ?, ?, 'Senior Product Designer (Design Systems)', 'Liderar la evolución visual y usabilidad del Design System de Nexorux HCM', 'Figma avanzado, tokens de diseño, atomic design, WCAG', 1, 'OPEN'),
    (?, ?, ?, ?, ?, 'B2B Growth Specialist LATAM', 'Responsable de la adquisición de clientes enterprise en México y Colombia', 'Venta SaaS consultiva, CRM Hubspot/Nexorux, inglés avanzado', 1, 'OPEN')
  `).run(
    job1, tenantId, compUY, deptEng, posStaffAI,
    job2, tenantId, compAR, deptPrd, posLeadUX,
    job3, tenantId, compUS, deptSales, posAccountExec
  );

  const candidates = [
    { first: 'Rodrigo', last: 'Sánchez', email: 'rodrigo.s@gmail.com', phone: '+598 99 221 001', stage: 'INTERVIEW', rating: 5, job: job1 },
    { first: 'Lucía', last: 'Fernández', email: 'lucia.f@design.io', phone: '+54 11 6721 9901', stage: 'TECHNICAL_TEST', rating: 4, job: job2 },
    { first: 'Gustavo', last: 'Barreto', email: 'gustavo.b@techcorp.com', phone: '+55 11 99821 4455', stage: 'OFFER', rating: 5, job: job1 },
    { first: 'Carolina', last: 'Vega', email: 'caro.vega@outlook.com', phone: '+1 786 441 9022', stage: 'SCREENING', rating: 3, job: job3 },
    { first: 'Esteban', last: 'García', email: 'esteban.garcia@dev.uy', phone: '+598 94 112 334', stage: 'APPLIED', rating: 4, job: job1 }
  ];

  const insertCandidate = db.prepare(`
    INSERT INTO candidates (id, tenant_id, job_opening_id, first_name, last_name, email, phone, current_stage, rating, notes, applied_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Candidato con excelente perfil técnico y fit cultural para Nexorux', datetime('now', '-5 days'))
  `);

  for (const c of candidates) {
    insertCandidate.run(uuidv4(), tenantId, c.job, c.first, c.last, c.email, c.phone, c.stage, c.rating);
  }

  ensureRecruitmentCostSeedData(tenantId);

  // 11. Initial Payroll Run
  const runId = uuidv4();
  db.prepare(`
    INSERT INTO payroll_runs (
      id, tenant_id, company_id, period_name, period_type, start_date, end_date, country_code,
      total_gross, total_deductions, total_net, total_employer_contributions, status, processed_at, created_at
    ) VALUES (
      ?, ?, ?, 'Agosto 2026 (Mensual Regular)', 'MONTHLY', '2026-08-01', '2026-08-31', 'UY',
      46300, 8950, 37350, 6120, 'APPROVED', datetime('now', '-6 days'), datetime('now', '-6 days')
    )
  `).run(runId, tenantId, compUY);

  // 12. Employee Documents
  const insertDoc = db.prepare(`
    INSERT INTO employee_documents (id, tenant_id, employee_id, title, category, file_url, file_size_bytes, mime_type, expiry_date, is_confidential)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertDoc.run(uuidv4(), tenantId, empCTO, 'Contrato de Trabajo y Confidencialidad Nexorux', 'CONTRACT', '/docs/contrato-cto.pdf', 1048576, 'application/pdf', null, 1);
  insertDoc.run(uuidv4(), tenantId, empStaffAI, 'Carné de Salud Laboral Vigente', 'CERTIFICATE', '/docs/salud-thiago.pdf', 524288, 'application/pdf', '2026-10-15', 0);
  insertDoc.run(uuidv4(), tenantId, empSales, 'Formulario W-4 Retención Impositiva US', 'TAX_FORM', '/docs/w4-jenkins.pdf', 314572, 'application/pdf', null, 1);
  insertDoc.run(uuidv4(), tenantId, empSrEng, 'Certificado de Antecedentes y Buena Conducta', 'CERTIFICATE', '/docs/conducta-martin.pdf', 419430, 'application/pdf', '2026-09-30', 0);

  // 13. Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, tenant_id, user_id, user_email, action, resource_type, resource_id, details_json, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, '192.168.1.50', datetime('now', ?))
  `);

  insertAudit.run(uuidv4(), tenantId, 'admin-user', 'admin@nexorux.com', 'TENANT_INITIALIZED', 'Tenant', tenantId, JSON.stringify({ slug: 'nexorux', name: 'Nexorux Technologies LLC' }), '-2 hours');
  insertAudit.run(uuidv4(), tenantId, 'hr-user', 'valeria.mendez@nexorux.com', 'EMPLOYEE_HIRED', 'Employee', empSales, JSON.stringify({ code: 'EMP-1008', name: 'Michael Jenkins', pos: 'Enterprise Account Executive' }), '-1 hour');
  insertAudit.run(uuidv4(), tenantId, 'hr-user', 'valeria.mendez@nexorux.com', 'LEAVE_REQUESTED', 'LeaveRequest', 'leave-1', JSON.stringify({ employee: 'Martín Alonso', days: 7, type: 'VACATION' }), '-30 minutes');
  insertAudit.run(uuidv4(), tenantId, 'payroll-user', 'gonzalo.peralta@nexorux.com', 'PAYROLL_APPROVED', 'PayrollRun', runId, JSON.stringify({ period: 'Agosto 2026', totalNet: 37350 }), '-15 minutes');

  console.log('Nexorux HR Enterprise seeded successfully!');
}

function ensureRecruitmentCostSeedData(tenantId: string) {
  const existingCosts = db.prepare('SELECT COUNT(*) as count FROM recruitment_costs WHERE tenant_id = ?').get(tenantId) as { count: number };
  if (existingCosts.count > 0) return;

  const opening = db.prepare("SELECT id FROM job_openings WHERE tenant_id = ? AND status = 'OPEN' ORDER BY created_at ASC LIMIT 1").get(tenantId) as { id: string } | undefined;
  if (!opening) return;

  db.prepare(`
    INSERT INTO recruitment_costs (id, tenant_id, job_opening_id, category, description, amount, hired_count, currency, incurred_at)
    VALUES (?, ?, ?, 'SOURCING', 'Campañas, portales y sourcing de talento del período inicial', 3700, 2, 'USD', date('now'))
  `).run(uuidv4(), tenantId, opening.id);
}
