import { db } from '../config/db';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeString } from '../utils/sanitize';
import fs from 'fs';
import path from 'path';
import {
  CandidateStage,
  CountryCode,
  Employee,
  LeaveRequest,
  LeaveStatus,
  PayrollRun,
  PayrollSlip,
  UserRole
} from '../domain/types';
import { CountryEngineFactory } from '../engines/CountryEngineFactory';
import { recordAudit } from '../middleware/context';
import { NexoruxAIService } from './NexoruxAIService';

export class HRService {
  // ================= DASHBOARD =================
  public static getDashboardMetrics(tenantId: string) {
    const totalEmployees = db.prepare('SELECT COUNT(*) as count FROM employees WHERE tenant_id = ?').get(tenantId) as { count: number };
    const activeEmployees = db.prepare("SELECT COUNT(*) as count FROM employees WHERE tenant_id = ? AND employment_status = 'ACTIVE'").get(tenantId) as { count: number };
    const probationEmployees = db.prepare("SELECT COUNT(*) as count FROM employees WHERE tenant_id = ? AND employment_status = 'PROBATION'").get(tenantId) as { count: number };
    
    // Attendances today
    const todayStr = new Date().toISOString().split('T')[0];
    const presentToday = db.prepare("SELECT COUNT(*) as count FROM attendances WHERE tenant_id = ? AND date = ? AND status = 'PRESENT'").get(tenantId, todayStr) as { count: number };
    const lateToday = db.prepare("SELECT COUNT(*) as count FROM attendances WHERE tenant_id = ? AND date = ? AND status = 'LATE'").get(tenantId, todayStr) as { count: number };

    // Pending Leaves
    const pendingLeaves = db.prepare("SELECT COUNT(*) as count FROM leave_requests WHERE tenant_id = ? AND status = 'PENDING'").get(tenantId) as { count: number };

    // Open Jobs & Candidates
    const openJobs = db.prepare("SELECT COUNT(*) as count FROM job_openings WHERE tenant_id = ? AND status = 'OPEN'").get(tenantId) as { count: number };
    const totalCandidates = db.prepare('SELECT COUNT(*) as count FROM candidates WHERE tenant_id = ?').get(tenantId) as { count: number };

    // Payroll Summary (Last Run)
    const lastPayroll = db.prepare('SELECT * FROM payroll_runs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1').get(tenantId) as PayrollRun | undefined;

    // Department Distribution
    const deptDistribution = db.prepare(`
      SELECT d.name as department, COUNT(e.id) as count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.tenant_id = ?
      WHERE d.tenant_id = ?
      GROUP BY d.id
    `).all(tenantId, tenantId);

    // Recent Audit Logs
    const recentActivity = db.prepare(`
      SELECT * FROM audit_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 6
    `).all(tenantId);

    // Expiring Contracts in next 45 days
    const expiringContracts = db.prepare(`
      SELECT c.*, e.first_name, e.last_name, e.employee_code, p.title as position_title
      FROM contracts c
      JOIN employees e ON c.employee_id = e.id
      JOIN positions p ON e.position_id = p.id
      WHERE c.tenant_id = ? AND c.status = 'ACTIVE' AND c.end_date IS NOT NULL
      ORDER BY c.end_date ASC LIMIT 5
    `).all(tenantId);

    const activeCountForTurnover = (db.prepare("SELECT COUNT(*) as count FROM employees WHERE tenant_id = ? AND employment_status = 'ACTIVE'").get(tenantId) as { count: number }).count;
    const terminatedRecentlyForTurnover = (db.prepare("SELECT COUNT(*) as count FROM employees WHERE tenant_id = ? AND employment_status = 'TERMINATED' AND updated_at >= date('now', '-30 days')").get(tenantId) as { count: number }).count;
    const turnoverRateMonthly = activeCountForTurnover ? Number(((terminatedRecentlyForTurnover / activeCountForTurnover) * 100).toFixed(1)) : 0;

    return {
      headcount: {
        total: totalEmployees.count,
        active: activeEmployees.count,
        probation: probationEmployees.count,
        turnoverRateMonthly
      },
      attendanceToday: {
        present: presentToday.count,
        late: lateToday.count,
        attendanceRate: totalEmployees.count > 0 ? Math.round(((presentToday.count + lateToday.count) / totalEmployees.count) * 100) : 100
      },
      pendingLeavesCount: pendingLeaves.count,
      recruitment: {
        openJobsCount: openJobs.count,
        candidatesInPipeline: totalCandidates.count
      },
      lastPayroll,
      deptDistribution,
      expiringContracts,
      recentActivity
    };
  }

  public static getAnalytics(tenantId: string) {
    const payrollDistribution = db.prepare(`
      SELECT d.name as label, ROUND(COALESCE(SUM(ps.gross_earnings), 0), 2) as amount
      FROM payroll_slips ps
      JOIN employees e ON e.id = ps.employee_id AND e.tenant_id = ?
      JOIN departments d ON d.id = e.department_id
      JOIN payroll_runs pr ON pr.id = ps.payroll_run_id AND pr.tenant_id = ?
      WHERE pr.id = (SELECT id FROM payroll_runs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1)
      GROUP BY d.id, d.name
      ORDER BY amount DESC
    `).all(tenantId, tenantId, tenantId) as { label: string; amount: number }[];

    const payrollTotal = payrollDistribution.reduce((total, item) => total + item.amount, 0);
    const payrollByDepartment = payrollDistribution.map(item => ({
      label: item.label,
      value: payrollTotal ? Number(((item.amount / payrollTotal) * 100).toFixed(1)) : 0
    }));

    const attendanceTrend = db.prepare(`
      SELECT date,
        ROUND(100.0 * SUM(CASE WHEN status IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as rate
      FROM attendances
      WHERE tenant_id = ? AND date >= date('now', '-6 days')
      GROUP BY date
      ORDER BY date ASC
    `).all(tenantId) as { date: string; rate: number }[];

    const geographicDistribution = db.prepare(`
      SELECT c.country_code as countryCode, b.city, COUNT(e.id) as employeeCount
      FROM employees e
      JOIN companies c ON c.id = e.company_id
      JOIN branches b ON b.id = e.branch_id
      WHERE e.tenant_id = ? AND e.employment_status != 'TERMINATED'
      GROUP BY c.country_code, b.city
      ORDER BY employeeCount DESC
    `).all(tenantId) as { countryCode: CountryCode; city: string; employeeCount: number }[];

    const activeCount = (db.prepare("SELECT COUNT(*) as count FROM employees WHERE tenant_id = ? AND employment_status = 'ACTIVE'").get(tenantId) as { count: number }).count;
    const terminatedRecently = (db.prepare("SELECT COUNT(*) as count FROM employees WHERE tenant_id = ? AND employment_status = 'TERMINATED' AND updated_at >= date('now', '-30 days')").get(tenantId) as { count: number }).count;
    const completedOnboarding = db.prepare(`
      SELECT AVG(julianday(t.completed_at) - julianday(e.hire_date)) as averageDays
      FROM onboarding_tasks t
      JOIN employees e ON e.id = t.employee_id
      WHERE t.tenant_id = ? AND t.is_completed = 1 AND t.completed_at IS NOT NULL
    `).get(tenantId) as { averageDays: number | null };
    const attendanceSummary = db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent
      FROM attendances
      WHERE tenant_id = ? AND date >= date('now', '-29 days')
    `).get(tenantId) as { total: number; absent: number };
    const recruitmentSpend = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as totalAmount, COALESCE(SUM(hired_count), 0) as hiredCount
      FROM recruitment_costs
      WHERE tenant_id = ?
    `).get(tenantId) as { totalAmount: number; hiredCount: number };

    return {
      turnoverRateMonthly: activeCount ? Number(((terminatedRecently / activeCount) * 100).toFixed(1)) : 0,
      absenteeismRate: attendanceSummary.total ? Number(((attendanceSummary.absent / attendanceSummary.total) * 100).toFixed(1)) : 0,
      payrollByDepartment,
      attendanceTrend,
      geographicDistribution,
      averageOnboardingDays: completedOnboarding.averageDays === null ? null : Number(completedOnboarding.averageDays.toFixed(1)),
      hiringCost: recruitmentSpend.hiredCount > 0
        ? Number((recruitmentSpend.totalAmount / recruitmentSpend.hiredCount).toFixed(2))
        : null
    };
  }

  public static getRecruitmentCosts(tenantId: string) {
    return db.prepare(`
      SELECT rc.*, j.title as job_title
      FROM recruitment_costs rc
      LEFT JOIN job_openings j ON j.id = rc.job_opening_id
      WHERE rc.tenant_id = ?
      ORDER BY rc.incurred_at DESC, rc.created_at DESC
    `).all(tenantId);
  }

  public static createRecruitmentCost(tenantId: string, data: any) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO recruitment_costs (id, tenant_id, job_opening_id, category, description, amount, hired_count, currency, incurred_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tenantId,
      data.job_opening_id || null,
      data.category,
      data.description,
      Number(data.amount),
      Number(data.hired_count || 0),
      data.currency || 'USD',
      data.incurred_at || new Date().toISOString().split('T')[0]
    );
    return db.prepare('SELECT * FROM recruitment_costs WHERE id = ? AND tenant_id = ?').get(id, tenantId);
  }

  // ================= EMPLOYEES =================
  public static getEmployees(tenantId: string, search?: string, departmentId?: string, status?: string, page = 1, limit = 50) {
    let query = `
      SELECT
        e.*,
        c.name as company_name,
        b.name as branch_name,
        d.name as department_name,
        p.title as position_title,
        p.level as position_level,
        m.first_name || ' ' || m.last_name as manager_name
      FROM employees e
      LEFT JOIN companies c ON e.company_id = c.id
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.tenant_id = ?
    `;
    const params: any[] = [tenantId];

    if (search) {
      query += ` AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ? OR e.email LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (departmentId) {
      query += ` AND e.department_id = ?`;
      params.push(departmentId);
    }
    if (status) {
      query += ` AND e.employment_status = ?`;
      params.push(status);
    }

    query += ` ORDER BY e.last_name ASC, e.first_name ASC LIMIT ? OFFSET ?`;
    params.push(Math.min(limit, 100), (page - 1) * limit);
    return db.prepare(query).all(...params);
  }

  public static getEmployeeById(tenantId: string, id: string) {
    const employee = db.prepare(`
      SELECT 
        e.*,
        c.name as company_name,
        c.country_code as company_country,
        b.name as branch_name,
        d.name as department_name,
        p.title as position_title,
        p.level as position_level,
        m.first_name || ' ' || m.last_name as manager_name
      FROM employees e
      LEFT JOIN companies c ON e.company_id = c.id
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.tenant_id = ? AND e.id = ?
    `).get(tenantId, id) as any;

    if (!employee) return null;

    const contracts = db.prepare('SELECT * FROM contracts WHERE tenant_id = ? AND employee_id = ? ORDER BY start_date DESC').all(tenantId, id);
    const salaryHistories = db.prepare('SELECT * FROM salary_histories WHERE tenant_id = ? AND employee_id = ? ORDER BY effective_date DESC').all(tenantId, id);
    const documents = db.prepare('SELECT * FROM employee_documents WHERE tenant_id = ? AND employee_id = ? ORDER BY uploaded_at DESC').all(tenantId, id);
    const leaveBalances = db.prepare('SELECT * FROM leave_balances WHERE tenant_id = ? AND employee_id = ? ORDER BY year DESC').all(tenantId, id);
    const attendances = db.prepare('SELECT * FROM attendances WHERE tenant_id = ? AND employee_id = ? ORDER BY date DESC LIMIT 15').all(tenantId, id);
    const onboardingTasks = db.prepare('SELECT * FROM onboarding_tasks WHERE tenant_id = ? AND employee_id = ? ORDER BY due_date ASC').all(tenantId, id);

    // Country engine vacation entitlement
    const engine = CountryEngineFactory.getEngine(employee.company_country || 'UY');
    const hireYear = new Date(employee.hire_date).getFullYear();
    const currentYear = new Date().getFullYear();
    const tenureYears = Math.max(0, currentYear - hireYear);
    const vacationRules = engine.calculateVacationDays(tenureYears);
    const vacationSalaryBonus = engine.calculateVacationBonus(employee.base_salary, vacationRules.totalEntitledDays);

    return {
      ...employee,
      contracts,
      salaryHistories,
      documents,
      leaveBalances,
      attendances,
      onboardingTasks,
      legalEntitlement: {
        ...vacationRules,
        estimatedVacationBonus: vacationSalaryBonus,
        currency: employee.currency
      }
    };
  }

  public static createEmployee(tenantId: string, data: any, actorUserId: string, actorEmail?: string) {
    const id = uuidv4();
    const employeeCode = sanitizeString(data.employee_code) || `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

    const currentYear = new Date().getFullYear();
    const hireDate = sanitizeString(data.hire_date) || new Date().toISOString().split('T')[0];

    let companyId = data.company_id;
    if (!companyId) {
      const defaultCompany = db.prepare('SELECT id FROM companies WHERE tenant_id = ? AND is_headquarters = 1 LIMIT 1').get(tenantId) as { id: string } | undefined;
      companyId = defaultCompany?.id ?? null;
    }

    let branchId = data.branch_id;
    if (!branchId) {
      const defaultBranch = db.prepare('SELECT id FROM branches WHERE tenant_id = ? LIMIT 1').get(tenantId) as { id: string } | undefined;
      branchId = defaultBranch?.id ?? null;
    }

    let departmentId = data.department_id;
    if (!departmentId) {
      const defaultDept = db.prepare('SELECT id FROM departments WHERE tenant_id = ? LIMIT 1').get(tenantId) as { id: string } | undefined;
      departmentId = defaultDept?.id ?? null;
    }

    let positionId = data.position_id;
    if (!positionId) {
      const defaultPos = db.prepare('SELECT id FROM positions WHERE tenant_id = ? LIMIT 1').get(tenantId) as { id: string } | undefined;
      positionId = defaultPos?.id ?? null;
    }

    db.transaction(() => {
      db.prepare(`
        INSERT INTO employees (
          id, tenant_id, company_id, branch_id, department_id, position_id, manager_id,
          employee_code, first_name, last_name, email, phone, gender, birth_date,
          national_id, tax_id, hire_date, employment_status, contract_type, base_salary,
          currency, photo_url, emergency_contact_json, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, datetime('now'), datetime('now')
        )
      `).run(
        id, tenantId, companyId, branchId, departmentId, positionId, data.manager_id || null,
        employeeCode, sanitizeString(data.first_name), sanitizeString(data.last_name), sanitizeString(data.email), sanitizeString(data.phone) || '', data.gender || 'OTHER', sanitizeString(data.birth_date) || '1995-01-01',
        sanitizeString(data.national_id) || '', sanitizeString(data.tax_id) || '', hireDate,
        data.employment_status || 'ACTIVE', data.contract_type || 'INDEFINITE', Number(data.base_salary) || 50000,
        data.currency || 'USD', data.photo_url || null, JSON.stringify(data.emergency_contact || {})
      );

      const contractId = uuidv4();
      db.prepare(`
        INSERT INTO contracts (
          id, tenant_id, employee_id, contract_number, type, start_date, end_date, probation_end_date, base_salary, currency, work_hours_per_week, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `).run(
        contractId, tenantId, id, `CTR-${employeeCode}`, data.contract_type || 'INDEFINITE',
        hireDate, data.contract_end_date || null,
        data.probation_end_date || null, Number(data.base_salary) || 50000, data.currency || 'USD', 40
      );

      const balanceId = uuidv4();
      db.prepare(`
        INSERT INTO leave_balances (
          id, tenant_id, employee_id, year, allocated_days, used_days, pending_days, remaining_days
        ) VALUES (?, ?, ?, ?, 20, 0, 0, 20)
      `).run(balanceId, tenantId, id, currentYear);

      const tasks = [
        { title: 'Firma de Contrato y Políticas Nexorux', category: 'DOCUMENTATION' },
        { title: 'Creación de correo corporativo y accesos SSO', category: 'IT_SETUP' },
        { title: 'Entrega de equipo de trabajo (Laptop, Periféricos)', category: 'EQUIPMENT' },
        { title: 'Reunión 1:1 de bienvenida con Manager', category: 'MEETING' },
        { title: 'Completar curso de inducción y seguridad Nexorux', category: 'TRAINING' }
      ];

      for (const t of tasks) {
        db.prepare(`
          INSERT INTO onboarding_tasks (id, tenant_id, employee_id, title, description, category, due_date, is_completed)
          VALUES (?, ?, ?, ?, ?, ?, date('now', '+7 days'), 0)
        `).run(uuidv4(), tenantId, id, t.title, `Tarea asignada automáticamente durante el onboarding de ${data.first_name} ${data.last_name}`, t.category);
      }
    })();

    recordAudit(tenantId, actorUserId, actorEmail, 'EMPLOYEE_CREATED', 'Employee', id, {
      name: `${data.first_name} ${data.last_name}`,
      code: employeeCode,
      salary: Number(data.base_salary)
    });

    return this.getEmployeeById(tenantId, id);
  }

  public static updateEmployee(tenantId: string, id: string, data: any, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM employees WHERE tenant_id = ? AND id = ?').get(tenantId, id) as Employee;
    if (!existing) throw new Error('Empleado no encontrado');

    // Check salary change for audit & history
    if (data.base_salary !== undefined && Number(data.base_salary) !== existing.base_salary) {
      db.prepare(`
        INSERT INTO salary_histories (id, tenant_id, employee_id, effective_date, previous_salary, new_salary, currency, reason, approved_by_user_id, created_at)
        VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        uuidv4(), tenantId, id, existing.base_salary, Number(data.base_salary),
        data.currency || existing.currency, data.salary_change_reason || 'Ajuste salarial programado', actorUserId
      );

      recordAudit(tenantId, actorUserId, actorEmail, 'SALARY_CHANGED', 'Employee', id, {
        previousSalary: existing.base_salary,
        newSalary: Number(data.base_salary),
        reason: data.salary_change_reason || 'Ajuste salarial'
      });
    }

    db.prepare(`
      UPDATE employees SET
        first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        department_id = COALESCE(?, department_id),
        position_id = COALESCE(?, position_id),
        branch_id = COALESCE(?, branch_id),
        manager_id = ?,
        employment_status = COALESCE(?, employment_status),
        base_salary = COALESCE(?, base_salary),
        currency = COALESCE(?, currency),
        updated_at = datetime('now')
      WHERE tenant_id = ? AND id = ?
    `).run(
      data.first_name, data.last_name, data.email, data.phone,
      data.department_id, data.position_id, data.branch_id,
      data.manager_id !== undefined ? data.manager_id : existing.manager_id,
      data.employment_status, data.base_salary, data.currency,
      tenantId, id
    );

    recordAudit(tenantId, actorUserId, actorEmail, 'EMPLOYEE_UPDATED', 'Employee', id, {
      updatedFields: Object.keys(data)
    });

    return this.getEmployeeById(tenantId, id);
  }

  // ================= ORGANIZATION & ORG CHART =================
  public static getOrganizationTree(tenantId: string) {
    const employees = db.prepare(`
      SELECT 
        e.id, e.first_name, e.last_name, e.employee_code, e.photo_url, e.email,
        e.manager_id, p.title as position_title, p.level as position_level,
        d.name as department_name, b.city as branch_city
      FROM employees e
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN branches b ON e.branch_id = b.id
      WHERE e.tenant_id = ? AND e.employment_status != 'TERMINATED'
    `).all(tenantId) as any[];

    // Map into hierarchical tree
    const map = new Map<string, any>();
    employees.forEach(emp => {
      map.set(emp.id, { ...emp, subordinates: [] });
    });

    const roots: any[] = [];
    employees.forEach(emp => {
      if (emp.manager_id && map.has(emp.manager_id)) {
        map.get(emp.manager_id).subordinates.push(map.get(emp.id));
      } else {
        roots.push(map.get(emp.id));
      }
    });

    return roots;
  }

  public static getCompanies(tenantId: string) {
    return db.prepare('SELECT * FROM companies WHERE tenant_id = ? ORDER BY is_headquarters DESC, name ASC').all(tenantId);
  }

  public static getBranches(tenantId: string, companyId?: string) {
    let query = 'SELECT * FROM branches WHERE tenant_id = ?';
    const params: any[] = [tenantId];
    if (companyId) {
      query += ' AND company_id = ?';
      params.push(companyId);
    }
    query += ' ORDER BY name ASC';
    return db.prepare(query).all(...params);
  }

  public static getDepartments(tenantId: string, companyId?: string) {
    let query = `
      SELECT d.*, COUNT(e.id) as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.id = e.department_id AND e.tenant_id = ?
      WHERE d.tenant_id = ?
    `;
    const params: any[] = [tenantId, tenantId];
    if (companyId) {
      query += ' AND d.company_id = ?';
      params.push(companyId);
    }
    query += ' GROUP BY d.id ORDER BY d.name ASC';
    return db.prepare(query).all(...params);
  }

  public static getPositions(tenantId: string, departmentId?: string) {
    let query = `
      SELECT p.*, d.name as department_name, COUNT(e.id) as employee_count
      FROM positions p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN employees e ON p.id = e.position_id AND e.tenant_id = ?
      WHERE p.tenant_id = ?
    `;
    const params: any[] = [tenantId, tenantId];
    if (departmentId) {
      query += ' AND p.department_id = ?';
      params.push(departmentId);
    }
    query += ' GROUP BY p.id ORDER BY p.title ASC';
    return db.prepare(query).all(...params);
  }

  // ================= ATTENDANCE =================
  public static getAttendances(tenantId: string, date?: string, employeeId?: string) {
    let query = `
      SELECT a.*, e.first_name, e.last_name, e.employee_code, d.name as department_name
      FROM attendances a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE a.tenant_id = ?
    `;
    const params: any[] = [tenantId];
    if (date) {
      query += ` AND a.date = ?`;
      params.push(date);
    }
    if (employeeId) {
      query += ` AND a.employee_id = ?`;
      params.push(employeeId);
    }
    query += ` ORDER BY a.date DESC, a.clock_in DESC LIMIT 50`;
    return db.prepare(query).all(...params);
  }

  public static clockIn(tenantId: string, employeeId: string, notes?: string) {
    const today = new Date().toISOString().split('T')[0];
    const timeNow = new Date().toTimeString().split(' ')[0]; // HH:MM:SS
    const existing = db.prepare('SELECT * FROM attendances WHERE tenant_id = ? AND employee_id = ? AND date = ?').get(tenantId, employeeId, today) as any;

    if (existing && existing.clock_in) {
      return { message: 'Ya has registrado tu entrada para el día de hoy.', attendance: existing };
    }

    // Determine status (if clock-in is after 09:15, mark LATE)
    const hour = new Date().getHours();
    const minute = new Date().getMinutes();
    const isLate = hour > 9 || (hour === 9 && minute > 15);
    const status = isLate ? 'LATE' : 'PRESENT';

    const id = existing ? existing.id : uuidv4();
    if (existing) {
      db.prepare(`UPDATE attendances SET clock_in = ?, status = ?, notes = COALESCE(?, notes) WHERE id = ?`).run(timeNow, status, notes, id);
    } else {
      db.prepare(`
        INSERT INTO attendances (id, tenant_id, employee_id, date, clock_in, status, regular_hours, overtime_hours, break_minutes, notes)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
      `).run(id, tenantId, employeeId, today, timeNow, status, notes || null);
    }

    return { message: 'Entrada registrada exitosamente', clockInTime: timeNow, status };
  }

  public static clockOut(tenantId: string, employeeId: string, notes?: string) {
    const today = new Date().toISOString().split('T')[0];
    const timeNow = new Date().toTimeString().split(' ')[0];
    const record = db.prepare('SELECT * FROM attendances WHERE tenant_id = ? AND employee_id = ? AND date = ?').get(tenantId, employeeId, today) as any;

    if (!record || !record.clock_in) {
      throw new Error('Debes registrar tu entrada antes de registrar tu salida');
    }

    // Calculate hours worked
    const [inH, inM] = record.clock_in.split(':').map(Number);
    const [outH, outM] = timeNow.split(':').map(Number);
    const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM) - (record.break_minutes || 0);
    const hours = Math.max(0, Math.round((totalMinutes / 60) * 10) / 10);
    const regular = Math.min(8, hours);
    const overtime = Math.max(0, Math.round((hours - 8) * 10) / 10);

    db.prepare(`
      UPDATE attendances SET clock_out = ?, regular_hours = ?, overtime_hours = ?, notes = COALESCE(?, notes) WHERE id = ?
    `).run(timeNow, regular, overtime, notes, record.id);

    return { message: 'Salida registrada exitosamente', clockOutTime: timeNow, regularHours: regular, overtimeHours: overtime };
  }

  // ================= LEAVES & VACATIONS =================
  public static getLeaveRequests(tenantId: string, employeeId?: string) {
    let query = `
      SELECT l.*, e.first_name, e.last_name, e.employee_code, d.name as department_name,
             u.first_name || ' ' || u.last_name as approver_name
      FROM leave_requests l
      JOIN employees e ON l.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN users u ON l.approver_id = u.id
      WHERE l.tenant_id = ?
    `;
    const params: any[] = [tenantId];
    if (employeeId) {
      query += ` AND l.employee_id = ?`;
      params.push(employeeId);
    }
    query += ` ORDER BY l.created_at DESC`;
    return db.prepare(query).all(...params);
  }

  public static createLeaveRequest(tenantId: string, data: any) {
    const id = uuidv4();
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    db.prepare(`
      INSERT INTO leave_requests (id, tenant_id, employee_id, leave_type, start_date, end_date, days_count, status, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, datetime('now'))
    `).run(id, tenantId, data.employee_id, data.leave_type || 'VACATION', data.start_date, data.end_date, days, data.reason || '');

    return { id, days_count: days, status: 'PENDING' };
  }

  public static approveLeaveRequest(tenantId: string, requestId: string, approverUserId: string, actorEmail?: string) {
    const req = db.prepare('SELECT * FROM leave_requests WHERE tenant_id = ? AND id = ?').get(tenantId, requestId) as LeaveRequest;
    if (!req) throw new Error('Solicitud no encontrada');
    if (req.status !== 'PENDING') throw new Error('La solicitud ya fue procesada');

    const currentYear = new Date().getFullYear();
    db.transaction(() => {
      db.prepare(`UPDATE leave_requests SET status = 'APPROVED', approver_id = ? WHERE id = ?`).run(approverUserId, requestId);
      db.prepare(`
        UPDATE leave_balances SET
          used_days = used_days + ?,
          remaining_days = remaining_days - ?
        WHERE tenant_id = ? AND employee_id = ? AND year = ?
      `).run(req.days_count, req.days_count, tenantId, req.employee_id, currentYear);
    })();

    recordAudit(tenantId, approverUserId, actorEmail, 'LEAVE_APPROVED', 'LeaveRequest', requestId, {
      employeeId: req.employee_id,
      days: req.days_count,
      leaveType: req.leave_type
    });

    return { message: 'Solicitud aprobada con éxito', status: 'APPROVED' };
  }

  public static rejectLeaveRequest(tenantId: string, requestId: string, approverUserId: string, reason: string, actorEmail?: string) {
    const req = db.prepare('SELECT * FROM leave_requests WHERE tenant_id = ? AND id = ?').get(tenantId, requestId) as LeaveRequest;
    if (!req) throw new Error('Solicitud no encontrada');

    db.prepare(`UPDATE leave_requests SET status = 'REJECTED', approver_id = ?, rejection_reason = ? WHERE id = ?`).run(
      approverUserId, reason || 'Rechazado por el supervisor', requestId
    );

    recordAudit(tenantId, approverUserId, actorEmail, 'LEAVE_REJECTED', 'LeaveRequest', requestId, {
      employeeId: req.employee_id,
      reason
    });

    return { message: 'Solicitud rechazada', status: 'REJECTED' };
  }

  // ================= PAYROLL CORE & RUNS =================
  public static getPayrollRuns(tenantId: string) {
    return db.prepare(`
      SELECT p.*, c.name as company_name
      FROM payroll_runs p
      JOIN companies c ON p.company_id = c.id
      WHERE p.tenant_id = ?
      ORDER BY p.created_at DESC
    `).all(tenantId);
  }

  public static runPayrollCalculation(
    tenantId: string,
    companyId: string,
    periodName: string,
    periodType: 'MONTHLY' | 'MID_YEAR_BONUS' | 'YEAR_END_BONUS',
    countryCode: CountryCode,
    actorUserId: string,
    actorEmail?: string
  ) {
    const company = db.prepare('SELECT * FROM companies WHERE tenant_id = ? AND id = ?').get(tenantId, companyId) as any;
    if (!company) throw new Error('Empresa no encontrada');

    const employees = db.prepare(`
      SELECT * FROM employees WHERE tenant_id = ? AND company_id = ? AND employment_status != 'TERMINATED'
    `).all(tenantId, companyId) as Employee[];

    const engine = CountryEngineFactory.getEngine(countryCode || company.country_code);

    const runId = uuidv4();
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalEmployer = 0;

    const slips: any[] = [];

    for (const emp of employees) {
      let calcResult;
      let statutoryBonus = 0;

      if (periodType === 'MID_YEAR_BONUS' || periodType === 'YEAR_END_BONUS') {
        const bonus = engine.calculateStatutoryBonus(periodType === 'MID_YEAR_BONUS' ? 'MID_YEAR' : 'YEAR_END', emp.base_salary, 6);
        statutoryBonus = bonus.amount;
        calcResult = engine.calculatePayroll({
          baseSalary: statutoryBonus,
          workedDays: 30,
          totalDaysInMonth: 30,
          regularHours: 160,
          overtimeHours: 0,
          seniorityYears: 2
        });
      } else {
        calcResult = engine.calculatePayroll({
          baseSalary: emp.base_salary,
          workedDays: 30,
          totalDaysInMonth: 30,
          regularHours: 160,
          overtimeHours: 0,
          seniorityYears: 2
        });
      }

      totalGross += calcResult.totalGross;
      totalDeductions += calcResult.totalEmployeeDeductions;
      totalNet += calcResult.netSalary;
      totalEmployer += calcResult.totalEmployerContributions;

      slips.push({
        id: uuidv4(),
        tenant_id: tenantId,
        payroll_run_id: runId,
        employee_id: emp.id,
        base_salary: emp.base_salary,
        gross_earnings: calcResult.totalGross,
        statutory_bonus: statutoryBonus,
        overtime_pay: calcResult.overtimeEarnings,
        deductions: calcResult.totalEmployeeDeductions,
        net_pay: calcResult.netSalary,
        employer_taxes: calcResult.totalEmployerContributions,
        breakdown_json: JSON.stringify({
          employeeDeductions: calcResult.employeeDeductions,
          employerContributions: calcResult.employerContributions,
          metadata: calcResult.metadata
        })
      });
    }

    const today = new Date().toISOString().split('T')[0];
    db.transaction(() => {
      db.prepare(`
        INSERT INTO payroll_runs (
          id, tenant_id, company_id, period_name, period_type, start_date, end_date, country_code,
          total_gross, total_deductions, total_net, total_employer_contributions, status, processed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CALCULATED', datetime('now'), datetime('now'))
      `).run(
        runId, tenantId, companyId, periodName, periodType, today, today, countryCode,
        totalGross, totalDeductions, totalNet, totalEmployer
      );

      const insertSlip = db.prepare(`
        INSERT INTO payroll_slips (
          id, tenant_id, payroll_run_id, employee_id, base_salary, gross_earnings, statutory_bonus,
          overtime_pay, deductions, net_pay, employer_taxes, breakdown_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of slips) {
        insertSlip.run(
          s.id, s.tenant_id, s.payroll_run_id, s.employee_id, s.base_salary, s.gross_earnings,
          s.statutory_bonus, s.overtime_pay, s.deductions, s.net_pay, s.employer_taxes, s.breakdown_json
        );
      }
    })();

    recordAudit(tenantId, actorUserId, actorEmail, 'PAYROLL_CALCULATED', 'PayrollRun', runId, {
      periodName,
      companyId,
      totalGross,
      totalNet,
      employeeCount: employees.length
    });

    return {
      runId,
      totalGross,
      totalDeductions,
      totalNet,
      totalEmployer,
      employeesCount: employees.length,
      countryEngine: engine.countryName
    };
  }

  public static getPayrollSlips(tenantId: string, runId: string) {
    return db.prepare(`
      SELECT s.*, e.first_name, e.last_name, e.employee_code, p.title as position_title, d.name as department_name
      FROM payroll_slips s
      JOIN employees e ON s.employee_id = e.id
      LEFT JOIN positions p ON e.position_id = p.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE s.tenant_id = ? AND s.payroll_run_id = ?
      ORDER BY e.last_name ASC
    `).all(tenantId, runId);
  }

  // ================= RECRUITMENT & ATS =================
  public static getJobOpenings(tenantId: string) {
    return db.prepare(`
      SELECT j.*, d.name as department_name, p.title as position_title,
        COUNT(CASE WHEN c.current_stage IS NOT NULL AND c.current_stage != 'REJECTED' THEN c.id END) as candidates_count
      FROM job_openings j
      LEFT JOIN departments d ON j.department_id = d.id
      LEFT JOIN positions p ON j.position_id = p.id
      LEFT JOIN candidates c ON j.id = c.job_opening_id AND c.tenant_id = ?
      WHERE j.tenant_id = ?
      GROUP BY j.id
      ORDER BY j.created_at DESC
    `).all(tenantId, tenantId);
  }

  public static getCandidates(tenantId: string, jobOpeningId?: string) {
    let query = `
      SELECT c.*, j.title as job_title, d.name as department_name
      FROM candidates c
      JOIN job_openings j ON c.job_opening_id = j.id
      LEFT JOIN departments d ON j.department_id = d.id
      WHERE c.tenant_id = ? AND c.current_stage != 'REJECTED'
    `;
    const params: any[] = [tenantId];
    if (jobOpeningId) {
      query += ` AND c.job_opening_id = ?`;
      params.push(jobOpeningId);
    }
    query += ` ORDER BY c.applied_date DESC`;
    return db.prepare(query).all(...params);
  }

  public static updateCandidateStage(tenantId: string, candidateId: string, stage: CandidateStage, actorUserId: string) {
    db.prepare('UPDATE candidates SET current_stage = ? WHERE tenant_id = ? AND id = ?').run(stage, tenantId, candidateId);
    recordAudit(tenantId, actorUserId, undefined, 'CANDIDATE_STAGE_CHANGED', 'Candidate', candidateId, { newStage: stage });
    return { message: `Candidato movido a la etapa ${stage}`, candidateId, stage };
  }

  public static createJobOpening(tenantId: string, data: any, actorUserId: string, actorEmail?: string) {
    const id = uuidv4();
    const defaultCompany = db.prepare('SELECT id FROM companies WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1').get(tenantId) as { id: string } | undefined;
    const companyId = data.company_id || defaultCompany?.id || null;
    db.prepare(`
      INSERT INTO job_openings (id, tenant_id, title, description, requirements, openings_count, status, company_id, department_id, position_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?)
    `).run(
      id,
      tenantId,
      data.title,
      data.description,
      data.requirements || null,
      data.openings_count || 1,
      companyId,
      data.department_id || null,
      data.position_id || null,
      actorUserId
    );
    recordAudit(tenantId, actorUserId, actorEmail, 'JOB_OPENING_CREATED', 'JobOpening', id, data);
    return { id, ...data, company_id: companyId, status: 'OPEN' };
  }

  public static updateJobOpening(tenantId: string, openingId: string, data: any, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM job_openings WHERE tenant_id = ? AND id = ?').get(tenantId, openingId);
    if (!existing) throw new Error('Vacante no encontrada');
    db.prepare(`
      UPDATE job_openings SET title = ?, description = ?, requirements = ?, openings_count = ?, department_id = ?, position_id = ? WHERE id = ?
    `).run(data.title, data.description, data.requirements, data.openings_count || 1, data.department_id || null, data.position_id || null, openingId);
    recordAudit(tenantId, actorUserId, actorEmail, 'JOB_OPENING_UPDATED', 'JobOpening', openingId, data);
    return { id: openingId, ...data };
  }

  public static closeJobOpening(tenantId: string, openingId: string, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM job_openings WHERE tenant_id = ? AND id = ?').get(tenantId, openingId);
    if (!existing) throw new Error('Vacante no encontrada');
    db.prepare(`UPDATE job_openings SET status = 'CLOSED' WHERE id = ?`).run(openingId);
    recordAudit(tenantId, actorUserId, actorEmail, 'JOB_OPENING_CLOSED', 'JobOpening', openingId, {});
    return { message: 'Vacante cerrada', openingId };
  }

  public static createCandidate(tenantId: string, data: any, actorUserId: string, actorEmail?: string) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO candidates (id, tenant_id, job_opening_id, first_name, last_name, email, phone, current_stage, applied_date, notes, rating, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'APPLIED', datetime('now'), ?, ?, ?)
    `).run(id, tenantId, data.job_opening_id, data.first_name, data.last_name, data.email, data.phone || null, data.notes || null, data.rating || 0, actorUserId);
    recordAudit(tenantId, actorUserId, actorEmail, 'CANDIDATE_CREATED', 'Candidate', id, data);
    return { id, ...data };
  }

  public static updateCandidate(tenantId: string, candidateId: string, data: any, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM candidates WHERE tenant_id = ? AND id = ?').get(tenantId, candidateId);
    if (!existing) throw new Error('Candidato no encontrado');
    db.prepare(`
      UPDATE candidates SET first_name = ?, last_name = ?, email = ?, phone = ?, notes = ?, rating = ? WHERE id = ?
    `).run(data.first_name, data.last_name, data.email, data.phone || null, data.notes || null, data.rating || 0, candidateId);
    recordAudit(tenantId, actorUserId, actorEmail, 'CANDIDATE_UPDATED', 'Candidate', candidateId, data);
    return { id: candidateId, ...data };
  }

  public static rejectCandidate(tenantId: string, candidateId: string, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM candidates WHERE tenant_id = ? AND id = ?').get(tenantId, candidateId);
    if (!existing) throw new Error('Candidato no encontrado');
    db.prepare(`UPDATE candidates SET current_stage = 'REJECTED' WHERE id = ?`).run(candidateId);
    recordAudit(tenantId, actorUserId, actorEmail, 'CANDIDATE_REJECTED', 'Candidate', candidateId, {});
    return { message: 'Candidato descartado', candidateId };
  }

  public static hireCandidate(tenantId: string, candidateId: string, actorUserId: string, actorEmail?: string) {
    const candidate = db.prepare('SELECT * FROM candidates WHERE tenant_id = ? AND id = ?').get(tenantId, candidateId) as any;
    if (!candidate) throw new Error('Candidato no encontrado');
    if (candidate.current_stage === 'REJECTED') throw new Error('No se puede contratar un candidato descartado');
    if (candidate.hired_employee_id) {
      return {
        message: 'Candidato ya contratado',
        candidateId,
        employeeId: candidate.hired_employee_id,
        alreadyHired: true
      };
    }

    const opening = db.prepare('SELECT * FROM job_openings WHERE tenant_id = ? AND id = ?').get(tenantId, candidate.job_opening_id) as any;
    if (!opening) throw new Error('Vacante asociada no encontrada');

    const defaultCompany = db.prepare('SELECT id FROM companies WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1').get(tenantId) as { id: string } | undefined;
    const defaultBranch = db.prepare('SELECT id FROM branches WHERE tenant_id = ? LIMIT 1').get(tenantId) as { id: string } | undefined;
    const defaultDepartment = db.prepare('SELECT id FROM departments WHERE tenant_id = ? LIMIT 1').get(tenantId) as { id: string } | undefined;
    const defaultPosition = db.prepare('SELECT id FROM positions WHERE tenant_id = ? LIMIT 1').get(tenantId) as { id: string } | undefined;
    const companyId = opening.company_id || defaultCompany?.id;
    const branchId = defaultBranch?.id;
    const departmentId = opening.department_id || defaultDepartment?.id;
    const positionId = opening.position_id || defaultPosition?.id;
    if (!companyId) throw new Error('No hay compañía disponible para crear el empleado');
    if (!branchId) throw new Error('No hay sucursal disponible para crear el empleado');
    if (!departmentId) throw new Error('Asigná un departamento a la vacante (o creá uno en Organización)');
    if (!positionId) throw new Error('Asigná una posición a la vacante (o creá una en Organización)');

    const employee = this.createEmployee(tenantId, {
      first_name: candidate.first_name,
      last_name: candidate.last_name,
      email: candidate.email,
      phone: candidate.phone || '',
      company_id: companyId,
      branch_id: branchId,
      department_id: departmentId,
      position_id: positionId,
      hire_date: new Date().toISOString().split('T')[0],
      employment_status: 'PROBATION',
      contract_type: 'INDEFINITE',
      base_salary: 50000,
      currency: 'USD'
    }, actorUserId, actorEmail);

    db.prepare(`
      UPDATE candidates
      SET current_stage = 'HIRED', hired_employee_id = ?
      WHERE tenant_id = ? AND id = ?
    `).run(employee.id, tenantId, candidateId);

    const hiredCount = (db.prepare(`
      SELECT COUNT(*) as count FROM candidates
      WHERE tenant_id = ? AND job_opening_id = ? AND current_stage = 'HIRED'
    `).get(tenantId, opening.id) as { count: number }).count;

    let openingClosed = false;
    if (hiredCount >= (opening.openings_count || 1)) {
      db.prepare(`UPDATE job_openings SET status = 'CLOSED' WHERE id = ?`).run(opening.id);
      openingClosed = true;
      recordAudit(tenantId, actorUserId, actorEmail, 'JOB_OPENING_CLOSED', 'JobOpening', opening.id, { reason: 'filled' });
    }

    recordAudit(tenantId, actorUserId, actorEmail, 'CANDIDATE_HIRED', 'Candidate', candidateId, {
      employeeId: employee.id,
      jobOpeningId: opening.id
    });

    return {
      message: openingClosed
        ? 'Candidato contratado. Vacante cerrada automáticamente al completar los cupos.'
        : 'Candidato contratado. Empleado y checklist de onboarding creados.',
      candidateId,
      employeeId: employee.id,
      employee,
      openingClosed,
      hiredCount,
      openingsCount: opening.openings_count || 1
    };
  }

  // ================= DOCUMENTS & VAULT =================
  public static getDocuments(tenantId: string, employeeId?: string) {
    let query = `
      SELECT doc.*, e.first_name, e.last_name, e.employee_code
      FROM employee_documents doc
      JOIN employees e ON doc.employee_id = e.id
      WHERE doc.tenant_id = ?
    `;
    const params: any[] = [tenantId];
    if (employeeId) {
      query += ` AND doc.employee_id = ?`;
      params.push(employeeId);
    }
    query += ` ORDER BY doc.uploaded_at DESC`;
    return db.prepare(query).all(...params);
  }

  public static updateDocumentMetadata(tenantId: string, documentId: string, data: any, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM employee_documents WHERE tenant_id = ? AND id = ?').get(tenantId, documentId) as any;
    if (!existing) throw new Error('Documento no encontrado');
    const title = data.title || existing.title;
    const category = data.category || existing.category;
    const expiry_date = data.expiry_date !== undefined ? data.expiry_date : existing.expiry_date;
    db.prepare(`UPDATE employee_documents SET title = ?, category = ?, expiry_date = ? WHERE id = ?`).run(title, category, expiry_date, documentId);
    recordAudit(tenantId, actorUserId, actorEmail, 'DOCUMENT_UPDATED', 'EmployeeDocument', documentId, data);
    return { id: documentId, title, category, expiry_date };
  }

  public static replaceDocumentFile(tenantId: string, documentId: string, data: { fileName: string; mimeType: string; data: string }, actorUserId: string, actorEmail?: string) {
    const document = db.prepare('SELECT * FROM employee_documents WHERE tenant_id = ? AND id = ?').get(tenantId, documentId) as any;
    if (!document) throw new Error('Documento no encontrado');

    const storageDir = path.resolve(__dirname, '../../data/documents', tenantId);
    fs.mkdirSync(storageDir, { recursive: true });
    const safeName = `${documentId}-${path.basename(data.fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const base64 = String(data.data).replace(/^data:[^;]+;base64,/, '');
    const fileBuffer = Buffer.from(base64, 'base64');
    if (fileBuffer.length > 10 * 1024 * 1024) throw new Error('El documento no puede superar 10 MB');
    fs.writeFileSync(path.join(storageDir, safeName), fileBuffer);
    db.prepare('UPDATE employee_documents SET file_url = ?, file_size_bytes = ?, mime_type = ? WHERE id = ?').run(safeName, fileBuffer.length, data.mimeType, documentId);
    recordAudit(tenantId, actorUserId, actorEmail, 'DOCUMENT_REPLACED', 'EmployeeDocument', documentId, { fileName: data.fileName });
    return { id: documentId, file_url: safeName, file_size_bytes: fileBuffer.length, mime_type: data.mimeType };
  }

  public static deleteDocument(tenantId: string, documentId: string, actorUserId: string, actorEmail?: string) {
    const document = db.prepare('SELECT * FROM employee_documents WHERE tenant_id = ? AND id = ?').get(tenantId, documentId);
    if (!document) throw new Error('Documento no encontrado');
    try {
      const storageDir = path.resolve(__dirname, '../../data/documents', tenantId);
      const filePath = path.join(storageDir, path.basename((document as any).file_url));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore cleanup errors
    }
    db.prepare('DELETE FROM employee_documents WHERE id = ? AND tenant_id = ?').run(documentId, tenantId);
    recordAudit(tenantId, actorUserId, actorEmail, 'DOCUMENT_DELETED', 'EmployeeDocument', documentId, {});
    return { message: 'Documento eliminado', documentId };
  }

  // ================= ONBOARDING TASKS =================
  public static getOnboardingTasks(tenantId: string, employeeId?: string) {
    let query = `
      SELECT t.*, e.first_name, e.last_name, e.employee_code, p.title as position_title
      FROM onboarding_tasks t
      JOIN employees e ON t.employee_id = e.id
      LEFT JOIN positions p ON e.position_id = p.id
      WHERE t.tenant_id = ?
    `;
    const params: any[] = [tenantId];
    if (employeeId) {
      query += ` AND t.employee_id = ?`;
      params.push(employeeId);
    }
    query += ` ORDER BY t.due_date ASC`;
    return db.prepare(query).all(...params);
  }

  public static toggleOnboardingTask(tenantId: string, taskId: string) {
    const task = db.prepare('SELECT * FROM onboarding_tasks WHERE tenant_id = ? AND id = ?').get(tenantId, taskId) as any;
    if (!task) throw new Error('Tarea no encontrada');
    const newState = task.is_completed ? 0 : 1;
    const completedAt = newState ? new Date().toISOString() : null;
    db.prepare('UPDATE onboarding_tasks SET is_completed = ?, completed_at = ? WHERE id = ? AND tenant_id = ?').run(newState, completedAt, taskId, tenantId);
    return { taskId, is_completed: newState };
  }

  public static createOnboardingTask(tenantId: string, data: any, actorUserId: string, actorEmail?: string) {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO onboarding_tasks (id, tenant_id, employee_id, title, description, category, due_date, is_completed, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, tenantId, data.employee_id, data.title, data.description || null, data.category || 'DOCUMENTATION', data.due_date || null, actorUserId);
    recordAudit(tenantId, actorUserId, actorEmail, 'ONBOARDING_TASK_CREATED', 'OnboardingTask', id, data);
    return { id, ...data };
  }

  public static updateOnboardingTask(tenantId: string, taskId: string, data: any, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM onboarding_tasks WHERE tenant_id = ? AND id = ?').get(tenantId, taskId) as any;
    if (!existing) throw new Error('Tarea no encontrada');
    db.prepare(`
      UPDATE onboarding_tasks SET title = ?, description = ?, category = ?, due_date = ? WHERE id = ?
    `).run(data.title, data.description || null, data.category || existing.category, data.due_date || null, taskId);
    recordAudit(tenantId, actorUserId, actorEmail, 'ONBOARDING_TASK_UPDATED', 'OnboardingTask', taskId, data);
    return { id: taskId, ...data };
  }

  public static deleteOnboardingTask(tenantId: string, taskId: string, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM onboarding_tasks WHERE tenant_id = ? AND id = ?').get(tenantId, taskId);
    if (!existing) throw new Error('Tarea no encontrada');
    db.prepare('DELETE FROM onboarding_tasks WHERE id = ? AND tenant_id = ?').run(taskId, tenantId);
    recordAudit(tenantId, actorUserId, actorEmail, 'ONBOARDING_TASK_DELETED', 'OnboardingTask', taskId, {});
    return { message: 'Tarea eliminada', taskId };
  }

  // ================= ORGANIZATION: COMPANIES =================
  public static getCompany(tenantId: string, companyId: string) {
    return db.prepare('SELECT * FROM companies WHERE tenant_id = ? AND id = ?').get(tenantId, companyId) as any;
  }

  public static createCompany(tenantId: string, data: { name: string; tax_id?: string; country_code?: string; address?: string }, actorUserId: string, actorEmail?: string) {
    const id = uuidv4();
    db.prepare(`INSERT INTO companies (id, tenant_id, name, tax_id, country_code, address) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id, tenantId, data.name, data.tax_id || null, data.country_code || 'MX', data.address || null
    );
    recordAudit(tenantId, actorUserId, actorEmail, 'COMPANY_CREATED', 'Company', id, data);
    return { id, ...data };
  }

  public static updateCompany(tenantId: string, companyId: string, data: { name?: string; tax_id?: string; country_code?: string; address?: string }, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM companies WHERE tenant_id = ? AND id = ?').get(tenantId, companyId) as any;
    if (!existing) throw new Error('Empresa no encontrada');
    db.prepare(`UPDATE companies SET name = ?, tax_id = ?, country_code = ?, address = ? WHERE id = ?`).run(
      data.name ?? existing.name, data.tax_id ?? existing.tax_id, data.country_code ?? existing.country_code, data.address ?? existing.address, companyId
    );
    recordAudit(tenantId, actorUserId, actorEmail, 'COMPANY_UPDATED', 'Company', companyId, data);
    return { id: companyId, ...data };
  }

  public static deleteCompany(tenantId: string, companyId: string, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM companies WHERE tenant_id = ? AND id = ?').get(tenantId, companyId);
    if (!existing) throw new Error('Empresa no encontrada');
    db.prepare('DELETE FROM companies WHERE id = ?').run(companyId);
    recordAudit(tenantId, actorUserId, actorEmail, 'COMPANY_DELETED', 'Company', companyId, {});
    return { message: 'Empresa eliminada', companyId };
  }

  // ================= ORGANIZATION: BRANCHES =================
  public static createBranch(tenantId: string, data: { company_id: string; name: string; address?: string; manager?: string }, actorUserId: string, actorEmail?: string) {
    const id = uuidv4();
    db.prepare(`INSERT INTO branches (id, tenant_id, company_id, name, address, manager) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id, tenantId, data.company_id, data.name, data.address || null, data.manager || null
    );
    recordAudit(tenantId, actorUserId, actorEmail, 'BRANCH_CREATED', 'Branch', id, data);
    return { id, ...data };
  }

  public static updateBranch(tenantId: string, branchId: string, data: { name?: string; address?: string; manager?: string }, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM branches WHERE tenant_id = ? AND id = ?').get(tenantId, branchId) as any;
    if (!existing) throw new Error('Sucursal no encontrada');
    db.prepare(`UPDATE branches SET name = ?, address = ?, manager = ? WHERE id = ?`).run(
      data.name ?? existing.name, data.address ?? existing.address, data.manager ?? existing.manager, branchId
    );
    recordAudit(tenantId, actorUserId, actorEmail, 'BRANCH_UPDATED', 'Branch', branchId, data);
    return { id: branchId, ...data };
  }

  public static deleteBranch(tenantId: string, branchId: string, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM branches WHERE tenant_id = ? AND id = ?').get(tenantId, branchId);
    if (!existing) throw new Error('Sucursal no encontrada');
    db.prepare('DELETE FROM branches WHERE id = ?').run(branchId);
    recordAudit(tenantId, actorUserId, actorEmail, 'BRANCH_DELETED', 'Branch', branchId, {});
    return { message: 'Sucursal eliminada', branchId };
  }

  // ================= ORGANIZATION: DEPARTMENTS =================
  public static createDepartment(tenantId: string, data: { company_id: string; name: string; description?: string; head_id?: string }, actorUserId: string, actorEmail?: string) {
    const id = uuidv4();
    db.prepare(`INSERT INTO departments (id, tenant_id, company_id, name, description, head_id) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id, tenantId, data.company_id, data.name, data.description || null, data.head_id || null
    );
    recordAudit(tenantId, actorUserId, actorEmail, 'DEPARTMENT_CREATED', 'Department', id, data);
    return { id, ...data };
  }

  public static updateDepartment(tenantId: string, departmentId: string, data: { name?: string; description?: string; head_id?: string }, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM departments WHERE tenant_id = ? AND id = ?').get(tenantId, departmentId) as any;
    if (!existing) throw new Error('Departamento no encontrado');
    db.prepare(`UPDATE departments SET name = ?, description = ?, head_id = ? WHERE id = ?`).run(
      data.name ?? existing.name, data.description ?? existing.description, data.head_id ?? existing.head_id, departmentId
    );
    recordAudit(tenantId, actorUserId, actorEmail, 'DEPARTMENT_UPDATED', 'Department', departmentId, data);
    return { id: departmentId, ...data };
  }

  public static deleteDepartment(tenantId: string, departmentId: string, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM departments WHERE tenant_id = ? AND id = ?').get(tenantId, departmentId);
    if (!existing) throw new Error('Departamento no encontrado');
    db.prepare('DELETE FROM departments WHERE id = ?').run(departmentId);
    recordAudit(tenantId, actorUserId, actorEmail, 'DEPARTMENT_DELETED', 'Department', departmentId, {});
    return { message: 'Departamento eliminado', departmentId };
  }

  // ================= ORGANIZATION: POSITIONS =================
  public static createPosition(tenantId: string, data: { department_id: string; title: string; level?: string; salary_range_min?: number; salary_range_max?: number }, actorUserId: string, actorEmail?: string) {
    const id = uuidv4();
    db.prepare(`INSERT INTO positions (id, tenant_id, department_id, title, level, salary_range_min, salary_range_max) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      id, tenantId, data.department_id, data.title, data.level || null, data.salary_range_min ?? null, data.salary_range_max ?? null
    );
    recordAudit(tenantId, actorUserId, actorEmail, 'POSITION_CREATED', 'Position', id, data);
    return { id, ...data };
  }

  public static updatePosition(tenantId: string, positionId: string, data: { title?: string; level?: string; salary_range_min?: number; salary_range_max?: number }, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM positions WHERE tenant_id = ? AND id = ?').get(tenantId, positionId) as any;
    if (!existing) throw new Error('Puesto no encontrado');
    db.prepare(`UPDATE positions SET title = ?, level = ?, salary_range_min = ?, salary_range_max = ? WHERE id = ?`).run(
      data.title ?? existing.title, data.level ?? existing.level, data.salary_range_min ?? existing.salary_range_min, data.salary_range_max ?? existing.salary_range_max, positionId
    );
    recordAudit(tenantId, actorUserId, actorEmail, 'POSITION_UPDATED', 'Position', positionId, data);
    return { id: positionId, ...data };
  }

  public static deletePosition(tenantId: string, positionId: string, actorUserId: string, actorEmail?: string) {
    const existing = db.prepare('SELECT * FROM positions WHERE tenant_id = ? AND id = ?').get(tenantId, positionId);
    if (!existing) throw new Error('Puesto no encontrado');
    db.prepare('DELETE FROM positions WHERE id = ?').run(positionId);
    recordAudit(tenantId, actorUserId, actorEmail, 'POSITION_DELETED', 'Position', positionId, {});
    return { message: 'Puesto eliminado', positionId };
  }

  // ================= AUDIT LOGS =================
  public static getAuditLogs(tenantId: string, limit = 50, offset = 0) {
    return db.prepare(`
      SELECT * FROM audit_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(tenantId, Math.min(limit, 100), offset);
  }

  // ================= NEXORUX IA COPILOT =================
  public static queryNexoruxAI(tenantId: string, user: { role: UserRole; email: string }, prompt: string) {
    return NexoruxAIService.query(tenantId, user, prompt);
  }
}
