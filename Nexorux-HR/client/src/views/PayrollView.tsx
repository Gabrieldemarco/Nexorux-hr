import React, { useState, useEffect } from 'react';
import { 
  ReceiptText, 
  Calculator, 
  Play, 
  CheckCircle2, 
  FileText, 
  DollarSign, 
  Globe, 
  Scale, 
  ArrowRight,
  ShieldCheck,
  X,
  ExternalLink
} from 'lucide-react';
import { PayrollRun, UserRole } from '../types';
import { apiFetch } from '../api';

interface PayrollViewProps {
  activeRole: UserRole;
}

export const PayrollView: React.FC<PayrollViewProps> = ({ activeRole }) => {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Run Payroll Modal
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [periodName, setPeriodName] = useState('Septiembre 2026 (Mensual Regular)');
  const [periodType, setPeriodType] = useState<'MONTHLY' | 'MID_YEAR_BONUS' | 'YEAR_END_BONUS'>('MONTHLY');
  const [selectedCountry, setSelectedCountry] = useState<'UY' | 'AR' | 'BR' | 'US'>('UY');
  const [runMessage, setRunMessage] = useState('');

  // Payslips Inspection Modal
  const [activeRunSlips, setActiveRunSlips] = useState<any[] | null>(null);
  const [selectedSlip, setSelectedSlip] = useState<any | null>(null);

  // Engine Simulator State
  const [simCountry, setSimCountry] = useState<'UY' | 'AR' | 'BR' | 'US'>('UY');
  const [simSalary, setSimSalary] = useState(60000);
  const [simOvertime, setSimOvertime] = useState(6);
  const [simResult, setSimResult] = useState<any | null>(null);

  const canRunPayroll = ['SUPER_ADMIN', 'TENANT_OWNER', 'HR_ADMIN', 'PAYROLL_MANAGER'].includes(activeRole);

  const loadPayrollData = async () => {
    setLoading(true);
    try {
      const [runsData, compsData] = await Promise.all([
        apiFetch<PayrollRun[]>('/payroll/runs'),
        apiFetch<any[]>('/org/companies')
      ]);
      setRuns(runsData);
      setCompanies(compsData);
      if (compsData.length > 0 && !selectedCompanyId) {
        setSelectedCompanyId(compsData[0].id);
        setSelectedCountry(compsData[0].country_code);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayrollData();
    handleSimulate();
  }, []);

  const handleSimulate = async () => {
    try {
      const data = await apiFetch<any>('/engines/simulate', {
        method: 'POST',
        body: JSON.stringify({
          countryCode: simCountry,
          baseSalary: simSalary,
          overtimeHours: simOvertime,
          seniorityYears: 3
        })
      });
      setSimResult(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecutePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res: any = await apiFetch('/payroll/calculate', {
        method: 'POST',
        body: JSON.stringify({
          companyId: selectedCompanyId,
          periodName,
          periodType,
          countryCode: selectedCountry
        })
      });
      setIsRunModalOpen(false);
      setRunMessage(`¡Liquidación procesada con éxito con motor ${res.countryEngine}! (${res.employeesCount} colaboradores liquidados)`);
      loadPayrollData();
      setTimeout(() => setRunMessage(''), 5000);
    } catch (err: any) {
      alert(`Error en liquidación: ${err.message}`);
    }
  };

  const viewSlips = async (runId: string) => {
    try {
      const slips = await apiFetch<any[]>(`/payroll/slips/${runId}`);
      setActiveRunSlips(slips);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Bar */}
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple">Payroll Core + Engines</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Desacoplado de legislación local</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            Liquidación de Nómina & Motores de País
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Ejecución centralizada de pre-nóminas con motores dinámicos: Uruguay (BPS/IRPF), Argentina (SAC/SIPA), Brasil (13º/FGTS) y USA (FLSA/FICA).
          </p>
        </div>

        {canRunPayroll && (
          <button onClick={() => setIsRunModalOpen(true)} className="btn-primary">
            <Play size={14} />
            <span>Ejecutar Pre-Nómina</span>
          </button>
        )}
      </div>

      {runMessage && (
        <div className="glass-panel animate-fade-in" style={{
          padding: '14px 20px',
          borderRadius: 'var(--radius-md)',
          borderLeft: '4px solid #10B981',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--accent-emerald)'
        }}>
          <CheckCircle2 size={16} />
          <span>{runMessage}</span>
        </div>
      )}

      {/* Country Engine Simulation Card */}
      <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calculator size={18} color="var(--brand-primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Simulador Interactivo de Country Engines
            </h3>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Calcula retenciones de ley al instante</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>País / Motor</label>
            <select
              className="input-field"
              value={simCountry}
              onChange={e => { setSimCountry(e.target.value as any); }}
            >
              <option value="UY">🇺🇾 Uruguay HR Engine</option>
              <option value="AR">🇦🇷 Argentina HR Engine</option>
              <option value="BR">🇧🇷 Brasil HR Engine</option>
              <option value="US">🇺🇸 USA HR Engine</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Salario Nominal</label>
            <input
              type="number"
              className="input-field"
              value={simSalary}
              onChange={e => setSimSalary(Number(e.target.value))}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Horas Extra</label>
            <input
              type="number"
              className="input-field"
              value={simOvertime}
              onChange={e => setSimOvertime(Number(e.target.value))}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={handleSimulate} className="btn-secondary" style={{ width: '100%' }}>
              Recalcular
            </button>
          </div>
        </div>

        {simResult && simResult.calculation && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Bruto Devengado</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                ${simResult.calculation.totalGross.toLocaleString()}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--brand-primary)' }}>Incluye horas extra</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Deducciones de Ley (Empleado)</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-rose)', marginTop: '2px' }}>
                -${simResult.calculation.totalEmployeeDeductions.toLocaleString()}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {simResult.calculation.employeeDeductions.length} retenciones aplicadas
              </div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Líquido a Pagar (Net Pay)</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '2px' }}>
                ${simResult.calculation.netSalary.toLocaleString()}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--accent-emerald)' }}>Acreditación bancaria</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cargas Patronales (Costo Empresa)</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '2px' }}>
                +${simResult.calculation.totalEmployerContributions.toLocaleString()}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Seguridad social / ART / FGTS</div>
            </div>
          </div>
        )}
      </div>

      {/* Historical Payroll Runs Table */}
      <div className="data-table-container">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-card)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Historial de Períodos de Nómina Procesados</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Período de Liquidación</th>
              <th>Empresa</th>
              <th>Motor País</th>
              <th>Tipo</th>
              <th>Total Bruto</th>
              <th>Deducciones</th>
              <th>Total Líquido Neto</th>
              <th>Cargas Patronales</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Recibos</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Cargando liquidaciones...
                </td>
              </tr>
            ) : runs.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No se registran nóminas previas. Ejecuta la primera pre-nómina.
                </td>
              </tr>
            ) : (
              runs.map(run => (
                <tr key={run.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{run.period_name}</td>
                  <td>{run.company_name}</td>
                  <td>
                    <span className="badge badge-purple">{run.country_code}</span>
                  </td>
                  <td>{run.period_type}</td>
                  <td>${Number(run.total_gross).toLocaleString()}</td>
                  <td style={{ color: 'var(--accent-rose)' }}>-${Number(run.total_deductions).toLocaleString()}</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>${Number(run.total_net).toLocaleString()}</td>
                  <td style={{ color: 'var(--accent-amber)' }}>${Number(run.total_employer_contributions).toLocaleString()}</td>
                  <td>
                    <span className="badge badge-success">{run.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => viewSlips(run.id)}
                      className="btn-secondary"
                      style={{ padding: '5px 10px', fontSize: '11px' }}
                    >
                      <FileText size={12} />
                      <span>Ver Recibos</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ================= MODAL: RUN PAYROLL ================= */}
      {isRunModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 7, 18, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }} onClick={() => setIsRunModalOpen(false)}>
          <div
            className="glass-modal animate-fade-in"
            style={{ width: '560px', borderRadius: 'var(--radius-lg)', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ReceiptText size={18} color="var(--brand-primary)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Ejecutar Pre-Nómina</h3>
              </div>
              <button onClick={() => setIsRunModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecutePayroll} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Empresa a Liquidar</label>
                <select
                  className="input-field"
                  value={selectedCompanyId}
                  onChange={e => {
                    setSelectedCompanyId(e.target.value);
                    const comp = companies.find(c => c.id === e.target.value);
                    if (comp) setSelectedCountry(comp.country_code);
                  }}
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.country_code})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Motor Legal a Invocar</label>
                  <select
                    className="input-field"
                    value={selectedCountry}
                    onChange={e => setSelectedCountry(e.target.value as any)}
                  >
                    <option value="UY">Uruguay HR Engine (BPS / IRPF)</option>
                    <option value="AR">Argentina HR Engine (SAC / SIPA)</option>
                    <option value="BR">Brasil HR Engine (13º / FGTS / CLT)</option>
                    <option value="US">USA HR Engine (FLSA / FICA / W-2)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tipo de Liquidación</label>
                  <select
                    className="input-field"
                    value={periodType}
                    onChange={e => setPeriodType(e.target.value as any)}
                  >
                    <option value="MONTHLY">Mensual Regular</option>
                    <option value="MID_YEAR_BONUS">Aguinaldo / SAC (1ª Fracción Junio)</option>
                    <option value="YEAR_END_BONUS">Aguinaldo / 13º (2ª Fracción Diciembre)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nombre del Período</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={periodName}
                  onChange={e => setPeriodName(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsRunModalOpen(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Ejecutar & Generar Recibos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: VIEW PAYSLIPS OF A RUN ================= */}
      {activeRunSlips && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 7, 18, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 95,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }} onClick={() => { setActiveRunSlips(null); setSelectedSlip(null); }}>
          <div
            className="glass-modal animate-fade-in"
            style={{ width: '820px', borderRadius: 'var(--radius-lg)', padding: '24px', maxHeight: '85vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Recibos de Sueldo Digitales del Período
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Detalle individual liquidado por el Country Engine
                </p>
              </div>
              <button onClick={() => { setActiveRunSlips(null); setSelectedSlip(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {selectedSlip ? (
              /* Detailed Single Payslip View */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <button onClick={() => setSelectedSlip(null)} className="btn-secondary" style={{ alignSelf: 'flex-start', padding: '4px 10px', fontSize: '11px' }}>
                  ← Volver a la lista de recibos
                </button>

                <div className="glass-panel" style={{ padding: '20px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedSlip.first_name} {selectedSlip.last_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedSlip.employee_code} • {selectedSlip.position_title}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-success">DIGITAL SIGNED</span>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Auditoría Hash: #NEXO-99120</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Haberes / Earnings */}
                    <div>
                      <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>HABERES DEVENGADOS</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}>
                        <span>Salario Base Nominal:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>${selectedSlip.base_salary.toLocaleString()}</strong>
                      </div>
                      {selectedSlip.overtime_pay > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}>
                          <span>Horas Extras Devengadas:</span>
                          <strong style={{ color: 'var(--accent-emerald)' }}>+${selectedSlip.overtime_pay.toLocaleString()}</strong>
                        </div>
                      )}
                      {selectedSlip.statutory_bonus > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}>
                          <span>Aguinaldo / SAC / 13º:</span>
                          <strong style={{ color: 'var(--accent-amber)' }}>+${selectedSlip.statutory_bonus.toLocaleString()}</strong>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '8px' }}>
                        <span>Total Bruto:</span>
                        <span style={{ color: 'var(--text-primary)' }}>${selectedSlip.gross_earnings.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Descuentos / Deductions */}
                    <div>
                      <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>DESCUENTOS DE LEY</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}>
                        <span>Aportes Jubilatorios & Salud:</span>
                        <strong style={{ color: 'var(--accent-rose)' }}>-${selectedSlip.deductions.toLocaleString()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '8px' }}>
                        <span>Total Descuentos:</span>
                        <span style={{ color: 'var(--accent-rose)' }}>-${selectedSlip.deductions.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    marginTop: '20px',
                    padding: '16px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-emerald)' }}>LÍQUIDO A PERCIBIR (NET PAY)</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Monto acreditado en cuenta bancaria del colaborador</div>
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      ${selectedSlip.net_pay.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* List of all slips */
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Puesto</th>
                    <th>Bruto</th>
                    <th>Descuentos</th>
                    <th>Neto a Pagar</th>
                    <th style={{ textAlign: 'right' }}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRunSlips.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {s.first_name} {s.last_name}
                      </td>
                      <td>{s.position_title}</td>
                      <td>${s.gross_earnings.toLocaleString()}</td>
                      <td style={{ color: 'var(--accent-rose)' }}>-${s.deductions.toLocaleString()}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>${s.net_pay.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => setSelectedSlip(s)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                          Ver Recibo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
