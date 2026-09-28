import Groq from 'groq-sdk';
import { db } from '../config/db';
import { UserRole } from '../domain/types';

export interface AIServiceResult {
  response: string;
  isRestricted?: boolean;
}

const SYSTEM_PROMPT = `
Eres Nexorux IA Copilot, el asistente inteligente de Nexorux HR, una plataforma enterprise multi-tenant de Gestión de Recursos Humanos.
Tu objetivo es responder consultas sobre métricas, personal, nómina, licencias, contratos, rotación, headcount, cumplimiento legal y uso de la plataforma.
Responde SIEMPRE en español, de forma clara, concisa y profesional.
Usa los datos proporcionados en el contexto para responder.
Si no hay datos suficientes en el contexto, indícalo amablemente.
Nunca inventes cifras ni fechas.
No expongas información sensible de empleados individuales a menos que se solicite explícitamente y el usuario tenga permisos.

Contexto de la aplicación:
- Nexorux HR es un sistema modular con: Dashboard, Employees, Organization, Attendance, Leaves, Payroll, Recruitment, Onboarding, Documents, Portal ESS, Reports, Audit, Settings y Compensation.
- Entidades principales: employees, contracts, leave_balances, attendances, payroll_runs, payroll_slips, job_openings, candidates, onboarding_tasks, employee_documents, departments, positions, companies, branches, users, tenants, audit_logs, webhooks, tenant_api_keys.
- Roles de usuario: SUPER_ADMIN, TENANT_OWNER, HR_ADMIN, HR_MANAGER, MANAGER, RECRUITER, PAYROLL_MANAGER, EMPLOYEE.
- Módulos y permisos típicos: employee.view_all, employee.view_team, employee.view_self, salary.view, payroll.manage, reports.view, audit.view, tenant.manage, ai.use, recruitment.manage, onboarding.manage, document.manage, attendance.manage, leaves.manage, compensation.view.
- Países soportados: Uruguay, Argentina, Brasil y USA, con reglas laborales específicas por país.
- Si el usuario pregunta cómo hacer algo en la plataforma, explicale brevemente en qué módulo encontrarlo y qué información necesitaría cargar.
`;

const canViewSalaries = (role: UserRole) => ['SUPER_ADMIN', 'TENANT_OWNER', 'HR_ADMIN', 'PAYROLL_MANAGER'].includes(role);

function buildContext(tenantId: string, prompt: string, role: UserRole): string {
  const p = prompt.toLowerCase();
  const parts: string[] = [];

  try {
    const totalEmployees = db.prepare('SELECT COUNT(*) as count FROM employees WHERE tenant_id = ?').get(tenantId) as { count: number };
    const activeEmployees = db.prepare("SELECT COUNT(*) as count FROM employees WHERE tenant_id = ? AND employment_status = 'ACTIVE'").get(tenantId) as { count: number };
    const probationEmployees = db.prepare("SELECT COUNT(*) as count FROM employees WHERE tenant_id = ? AND employment_status = 'PROBATION'").get(tenantId) as { count: number };
    const terminatedEmployees = db.prepare("SELECT COUNT(*) as count FROM employees WHERE tenant_id = ? AND employment_status = 'TERMINATED'").get(tenantId) as { count: number };
    const pendingLeaves = db.prepare("SELECT COUNT(*) as count FROM leave_requests WHERE tenant_id = ? AND status = 'PENDING'").get(tenantId) as { count: number };
    const openJobs = db.prepare("SELECT COUNT(*) as count FROM job_openings WHERE tenant_id = ? AND status = 'OPEN'").get(tenantId) as { count: number };
    const lastPayroll = db.prepare('SELECT * FROM payroll_runs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1').get(tenantId) as any;

    parts.push(`Resumen general del tenant:`);
    parts.push(`- Total empleados: ${totalEmployees.count}`);
    parts.push(`- Activos: ${activeEmployees.count}`);
    parts.push(`- En prueba: ${probationEmployees.count}`);
    parts.push(`- Dados de baja: ${terminatedEmployees.count}`);
    parts.push(`- Licencias pendientes: ${pendingLeaves.count}`);
    parts.push(`- Puestos abiertos: ${openJobs.count}`);
    if (lastPayroll) {
      parts.push(`- Última nómina procesada: ${lastPayroll.period_name || lastPayroll.id}`);
    }

    if (p.includes('salario') || p.includes('sueldo') || p.includes('nómina') || p.includes('payroll')) {
      if (!canViewSalaries(role)) {
        parts.push(`[RESTRINGIDO] Tu rol actual no cuenta con el permiso salary.view para acceder a métricas de nómina.`);
      } else {
        const payroll = db.prepare('SELECT SUM(base_salary) as total, AVG(base_salary) as avg, COUNT(*) as count FROM employees WHERE tenant_id = ?').get(tenantId) as any;
        parts.push(`Masa salarial base mensual total: $${Number(payroll.total).toLocaleString()}.`);
        parts.push(`Salario promedio: $${Math.round(payroll.avg).toLocaleString()}.`);
        parts.push(`Cantidad de colaboradores con salario registrado: ${payroll.count}.`);
      }
    }

    if (p.includes('vacaciones') || p.includes('licencia') || p.includes('permiso')) {
      const leaves = db.prepare("SELECT COUNT(*) as count FROM leave_requests WHERE tenant_id = ? AND status = 'PENDING'").get(tenantId) as any;
      parts.push(`Solicitudes de licencia pendientes de aprobación: ${leaves.count}.`);
    }

    if (p.includes('rotación') || p.includes('turnover') || p.includes('bajas')) {
      const rate = activeEmployees.count ? ((terminatedEmployees.count / (activeEmployees.count + terminatedEmployees.count)) * 100).toFixed(1) : '0.0';
      parts.push(`Empleados activos: ${activeEmployees.count}.`);
      parts.push(`Empleados dados de baja: ${terminatedEmployees.count}.`);
      parts.push(`Tasa de rotación estimada: ${rate}%.`);
    }

    if (p.includes('departamento') || p.includes('headcount') || p.includes('distribución') || p.includes('organigrama')) {
      const depts = db.prepare(`
        SELECT d.name as department, COUNT(e.id) as count
        FROM departments d
        LEFT JOIN employees e ON d.id = e.department_id AND e.tenant_id = ?
        WHERE d.tenant_id = ?
        GROUP BY d.id
      `).all(tenantId, tenantId) as any[];
      if (depts.length > 0) {
        parts.push('Distribución de headcount por departamento:');
        depts.forEach(d => parts.push(`- ${d.department}: ${d.count}`));
      }

      const positions = db.prepare(`
        SELECT p.title, COUNT(e.id) as count
        FROM positions p
        LEFT JOIN employees e ON p.id = e.position_id AND e.tenant_id = ?
        WHERE p.tenant_id = ?
        GROUP BY p.id
      `).all(tenantId, tenantId) as any[];
      if (positions.length > 0) {
        parts.push('Distribución por posición:');
        positions.forEach(pos => parts.push(`- ${pos.title}: ${pos.count}`));
      }
    }

    if (p.includes('contrato') || p.includes('vencimiento') || p.includes('venc') || p.includes('prueba')) {
      const days = 45;
      const future = new Date();
      future.setDate(future.getDate() + days);
      const contracts = db.prepare(`
        SELECT e.first_name || ' ' || e.last_name AS full_name, c.end_date AS contract_end_date, e.employment_status, p.title as position_title
        FROM employees e
        JOIN positions p ON e.position_id = p.id
        JOIN contracts c ON c.employee_id = e.id AND c.tenant_id = e.tenant_id
        WHERE e.tenant_id = ?
          AND c.end_date IS NOT NULL
          AND c.end_date <= ?
          AND c.status = 'ACTIVE'
        ORDER BY c.end_date ASC
        LIMIT 5
      `).all(tenantId, future.toISOString().split('T')[0]) as any[];
      if (contracts.length > 0) {
        parts.push(`Contratos que vencen en los próximos ${days} días:`);
        contracts.forEach(c => parts.push(`- ${c.full_name} (${c.position_title}): ${c.contract_end_date} - Estado: ${c.employment_status}`));
      } else {
        parts.push(`No hay contratos que venzan en los próximos ${days} días.`);
      }
    }

    if (p.includes('asistencia') || p.includes('ausentismo') || p.includes('presente') || p.includes('tarde')) {
      const todayStr = new Date().toISOString().split('T')[0];
      const presentToday = db.prepare("SELECT COUNT(*) as count FROM attendances WHERE tenant_id = ? AND date = ? AND status = 'PRESENT'").get(tenantId, todayStr) as { count: number };
      const lateToday = db.prepare("SELECT COUNT(*) as count FROM attendances WHERE tenant_id = ? AND date = ? AND status = 'LATE'").get(tenantId, todayStr) as { count: number };
      const absentToday = db.prepare("SELECT COUNT(*) as count FROM attendances WHERE tenant_id = ? AND date = ? AND status = 'ABSENT'").get(tenantId, todayStr) as { count: number };
      const onLeaveToday = db.prepare("SELECT COUNT(*) as count FROM attendances WHERE tenant_id = ? AND date = ? AND status = 'ON_LEAVE'").get(tenantId, todayStr) as { count: number };
      const rate = totalEmployees.count > 0 ? Math.round(((presentToday.count + lateToday.count) / totalEmployees.count) * 100) : 100;
      parts.push(`Asistencia de hoy (${todayStr}):`);
      parts.push(`- Presentes: ${presentToday.count}`);
      parts.push(`- Llegadas tarde: ${lateToday.count}`);
      parts.push(`- Ausentes: ${absentToday.count}`);
      parts.push(`- En licencia: ${onLeaveToday}`);
      parts.push(`- Tasa de asistencia: ${rate}%`);
    }

    if (p.includes('reclutamiento') || p.includes('candidatos') || p.includes('pipeline') || p.includes('vacantes')) {
      const candidates = db.prepare(`
        SELECT current_stage, COUNT(*) as count
        FROM candidates
        WHERE tenant_id = ?
        GROUP BY current_stage
      `).all(tenantId) as any[];
      if (candidates.length > 0) {
        parts.push('Pipeline de reclutamiento por etapa:');
        candidates.forEach(c => parts.push(`- ${c.current_stage}: ${c.count}`));
      }
      parts.push(`- Puestos abiertos: ${openJobs.count}`);
    }

    if (p.includes('documento') || p.includes('certificado') || p.includes('vencimiento documento')) {
      const docs = db.prepare(`
        SELECT e.first_name || ' ' || e.last_name AS full_name, ed.title, ed.expiry_date
        FROM employee_documents ed
        JOIN employees e ON ed.employee_id = e.id AND ed.tenant_id = e.tenant_id
        WHERE ed.tenant_id = ?
          AND ed.expiry_date IS NOT NULL
          AND ed.expiry_date <= date('now', '+30 days')
        ORDER BY ed.expiry_date ASC
        LIMIT 5
      `).all(tenantId) as any[];
      if (docs.length > 0) {
        parts.push('Documentos próximos a vencer en los próximos 30 días:');
        docs.forEach(d => parts.push(`- ${d.full_name}: ${d.title} (vence ${d.expiry_date})`));
      } else {
        parts.push('No hay documentos próximos a vencer en los próximos 30 días.');
      }
    }

    if ((p.includes('nómina') || p.includes('payroll')) && canViewSalaries(role)) {
      if (lastPayroll) {
        parts.push(`Última nómina procesada: ${lastPayroll.period_name || lastPayroll.id}`);
        parts.push(`- Total bruto: $${Number(lastPayroll.total_gross).toLocaleString()}`);
        parts.push(`- Total deducciones: $${Number(lastPayroll.total_deductions).toLocaleString()}`);
        parts.push(`- Total neto: $${Number(lastPayroll.total_net).toLocaleString()}`);
        parts.push(`- Estado: ${lastPayroll.status}`);
      } else {
        parts.push('No hay nóminas procesadas aún.');
      }
    }

    if (p.includes('empresa') || p.includes('tenant') || p.includes('compañía') || p.includes('configuración')) {
      const tenant = db.prepare('SELECT legal_name, country_code, currency, timezone FROM tenants WHERE id = ? AND is_active = 1').get(tenantId) as any;
      if (tenant) {
        parts.push(`Información de la empresa:`);
        parts.push(`- Nombre legal: ${tenant.legal_name}`);
        parts.push(`- País: ${tenant.country_code}`);
        parts.push(`- Moneda: ${tenant.currency}`);
        parts.push(`- Zona horaria: ${tenant.timezone}`);
      }
    }
  } catch (err) {
    parts.push(`Error al consultar algunos datos: se recomienda verificar manualmente.`);
  }

  if (parts.length === 0) {
    parts.push('No se extrajeron datos específicos para esta consulta; responde con base en el conocimiento general de Nexorux HR y RRHH.');
  }

  return parts.join('\n');
}

export class NexoruxAIService {
  private static groq: Groq | null = null;

  private static getClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY no está configurada en las variables de entorno.');
    }
    if (!NexoruxAIService.groq) {
      NexoruxAIService.groq = new Groq({ apiKey });
    }
    return NexoruxAIService.groq;
  }

  static async query(tenantId: string, user: { role: UserRole; email: string }, prompt: string): Promise<AIServiceResult> {
    const p = prompt.toLowerCase();

    if (p.includes('salario') || p.includes('sueldo') || p.includes('nómina') || p.includes('payroll')) {
      if (!canViewSalaries(user.role)) {
        return {
          response: 'Tu rol actual no cuenta con el permiso para acceder o consultar métricas de nómina y salarios.',
          isRestricted: true,
        };
      }
    }

    const context = buildContext(tenantId, prompt, user.role);
    const userContext = `Usuario: ${user.email} | Rol: ${user.role}`;
    const fullPrompt = `${SYSTEM_PROMPT}\n\nContexto del sistema:\n${userContext}\n\nDatos relevantes extraídos de la base de datos:\n${context}\n\nPregunta del usuario: ${prompt}\n\nResponde de forma directa y útil, usando los datos del contexto.`;

    const client = this.getClient();

    const models = [
      'openai/gpt-oss-20b',
      'openai/gpt-oss-120b'
    ];

    let lastError: any = null;
    for (const model of models) {
      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Contexto del sistema:\n${userContext}\n\nDatos relevantes extraídos de la base de datos:\n${context}\n\nPregunta del usuario: ${prompt}`
            }
          ],
          temperature: 0.7,
          max_tokens: 1024
        });

        const response = completion.choices?.[0]?.message?.content || '';
        const trimmed = typeof response === 'string' ? response.trim() : '';
        if (!trimmed) {
          continue;
        }
        return { response: trimmed };
      } catch (err: any) {
        lastError = err;
      }
    }

    return {
      response: 'No se pudo generar una respuesta en este momento. Reintenta en unos segundos o consulta métricas más específicas.',
    };
  }
}
