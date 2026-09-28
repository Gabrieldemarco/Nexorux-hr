import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertTriangle, Calendar, Search, LogIn, LogOut, Download } from 'lucide-react';
import { AttendanceRecord } from '../types';
import { apiFetch } from '../api';
import { downloadCsv } from '../utils/downloadCsv';
import { downloadPdf } from '../utils/exportPdf';

export const AttendanceView: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<AttendanceRecord[]>(`/attendance?date=${selectedDate}`);
      setRecords(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [selectedDate]);

  const handleClockIn = async () => {
    try {
      const res: any = await apiFetch('/attendance/clock-in', {
        method: 'POST',
        body: JSON.stringify({ notes: 'Fichaje web regular' })
      });
      setActionMessage(res.message || 'Entrada registrada');
      loadAttendance();
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err: any) {
      setActionMessage(err.message);
      setTimeout(() => setActionMessage(''), 4000);
    }
  };

  const handleClockOut = async () => {
    try {
      const res: any = await apiFetch('/attendance/clock-out', {
        method: 'POST',
        body: JSON.stringify({ notes: 'Fichaje de salida regular' })
      });
      setActionMessage(res.message || 'Salida registrada');
      loadAttendance();
      setTimeout(() => setActionMessage(''), 4000);
    } catch (err: any) {
      setActionMessage(err.message);
      setTimeout(() => setActionMessage(''), 4000);
    }
  };

  const exportAttendance = () => {
    downloadCsv(`asistencia-${selectedDate}.csv`, records.map(record => ({
      fecha: record.date,
      empleado: `${record.first_name} ${record.last_name}`,
      codigo: record.employee_code,
      departamento: record.department_name,
      entrada: record.clock_in,
      salida: record.clock_out,
      horas: record.regular_hours,
      horasExtra: record.overtime_hours,
      estado: record.status,
      notas: record.notes
    })));
  };

  const exportAttendancePdf = () => downloadPdf(`asistencia-${selectedDate}.pdf`, `Libro de Asistencia ${selectedDate}`, records.map(record => ({
    empleado: `${record.first_name} ${record.last_name}`,
    entrada: record.clock_in,
    salida: record.clock_out,
    horas: record.regular_hours,
    estado: record.status
  })));

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Live Terminal Clock Card */}
      <div className="glass-panel" style={{
        padding: '24px',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px',
        background: 'var(--surface-gradient)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'var(--brand-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)'
          }}>
            <Clock size={28} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--brand-primary)', letterSpacing: '0.05em' }}>
              RELOJ DE CONTROL HORARIO & ASISTENCIA
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {currentTime}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Zona horaria: America/Montevideo (GMT-3) • Terminal Biométrica Virtual
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleClockIn}
            className="btn-primary"
            style={{
              padding: '12px 20px',
              background: '#10B981',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
            }}
          >
            <LogIn size={16} />
            <span>Fichar Entrada</span>
          </button>

          <button
            onClick={handleClockOut}
            className="btn-danger"
            style={{ padding: '12px 20px' }}
          >
            <LogOut size={16} />
            <span>Fichar Salida</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="glass-panel animate-fade-in" style={{
          padding: '12px 18px',
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
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Filter and Date Selector */}
      <div className="glass-panel" style={{
        padding: '14px 20px',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} color="var(--brand-primary)" />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Fecha:</span>
          </div>
          <input
            type="date"
            className="input-field"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ width: '160px' }}
          />
        </div>

        <button
          onClick={exportAttendance}
          className="btn-secondary"
        >
          <Download size={14} />
          <span>Exportar Libro de Asistencia</span>
        </button>
        <button onClick={exportAttendancePdf} className="btn-secondary">
          <Download size={14} />
          <span>PDF</span>
        </button>
      </div>

      {/* Attendance Records Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Departamento</th>
              <th>Fecha</th>
              <th>Hora Entrada</th>
              <th>Hora Salida</th>
              <th>Pausa</th>
              <th>Horas Reg.</th>
              <th>Horas Extra</th>
              <th>Estado</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Consultando marcas de asistencia...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No se registran marcas para la fecha seleccionada.
                </td>
              </tr>
            ) : (
              records.map(rec => (
                <tr key={rec.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {rec.first_name} {rec.last_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {rec.employee_code}
                    </div>
                  </td>
                  <td>{rec.department_name || 'General'}</td>
                  <td>{rec.date}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--brand-primary)' }}>
                    {rec.clock_in || '--:--:--'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--brand-primary)' }}>
                    {rec.clock_out || '--:--:--'}
                  </td>
                  <td>60 min</td>
                  <td style={{ fontWeight: 600 }}>{rec.regular_hours} hrs</td>
                  <td style={{ fontWeight: 700, color: rec.overtime_hours > 0 ? '#34D399' : 'inherit' }}>
                    {rec.overtime_hours > 0 ? `+${rec.overtime_hours} hrs (Extra)` : '0 hrs'}
                  </td>
                  <td>
                    <span className={`badge ${
                      rec.status === 'PRESENT'
                        ? 'badge-success'
                        : rec.status === 'LATE'
                          ? 'badge-warning'
                          : 'badge-danger'
                    }`}>
                      {rec.status === 'PRESENT' ? 'Presente' : rec.status === 'LATE' ? 'Llegada Tarde' : rec.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {rec.notes || 'Normal'}
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
