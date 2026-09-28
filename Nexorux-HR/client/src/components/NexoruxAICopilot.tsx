import React, { useState } from 'react';
import { Sparkles, Send, X, Bot, User, ShieldAlert, CornerDownLeft } from 'lucide-react';
import { apiFetch } from '../api';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  isRestricted?: boolean;
}

interface NexoruxAICopilotProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NexoruxAICopilot: React.FC<NexoruxAICopilotProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: '¡Hola! Soy **Nexorux IA Copilot**, tu asistente inteligente de Recursos Humanos. Puedo responder dudas sobre métricas de personal, nómina, licencias pendientes, contratos y cumplimiento legal en Uruguay, Argentina, Brasil y USA. ¿En qué te puedo ayudar hoy?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const suggestedPrompts = [
    '¿Cuántas licencias pendientes de aprobación hay?',
    '¿Qué contratos vencen en los próximos 45 días?',
    '¿Cuál es la masa salarial total y promedio?',
    'Analizar tasa de rotación y ausentismo',
    '¿Cómo está distribuido el headcount por departamento?'
  ];

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const newMsgs: Message[] = [...messages, { sender: 'user', text: query }];
    setMessages(newMsgs);
    setInput('');
    setIsLoading(true);

    try {
      const res: any = await apiFetch('/ai/query', {
        method: 'POST',
        body: JSON.stringify({ prompt: query })
      });

      setMessages([...newMsgs, {
        sender: 'ai',
        text: res.response || 'No se obtuvo respuesta del modelo.',
        isRestricted: res.isRestricted
      }]);
    } catch (err: any) {
      setMessages([...newMsgs, {
        sender: 'ai',
        text: `Error al procesar la consulta: ${err.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '68px',
      right: 0,
      bottom: 0,
      width: '420px',
      background: 'rgba(12, 18, 32, 0.95)',
      backdropFilter: 'blur(20px)',
      borderLeft: '1px solid var(--border-card)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 55,
      boxShadow: 'var(--shadow-lg)'
    }} className="animate-fade-in">
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--brand-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(168, 85, 247, 0.4)'
          }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#F8FAFC' }}>Nexorux IA Copilot</div>
            <div style={{ fontSize: '11px', color: '#A5B4FC' }}>HR Intelligence & Enterprise RAG</div>
          </div>
        </div>

        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={18} />
        </button>
      </div>

      {/* Suggested Prompts */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        gap: '6px',
        overflowX: 'auto'
      }}>
        {suggestedPrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSend(p)}
            style={{
              whiteSpace: 'nowrap',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              color: 'var(--text-secondary)',
              fontSize: '11px',
              padding: '4px 10px',
              borderRadius: '999px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-card)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Messages Thread */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: '10px',
              alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '90%'
            }}
          >
            {m.sender === 'ai' && (
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Bot size={14} color="#A5B4FC" />
              </div>
            )}

            <div style={{
              background: m.sender === 'user'
                ? 'var(--brand-primary)'
                : m.isRestricted
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'var(--bg-card)',
              border: m.isRestricted
                ? '1px solid rgba(239, 68, 68, 0.3)'
                : m.sender === 'user'
                  ? 'none'
                  : '1px solid var(--border-card)',
              color: 'var(--text-primary)',
              padding: '10px 14px',
              borderRadius: '12px',
              fontSize: '13px',
              lineHeight: 1.5,
              boxShadow: 'var(--shadow-sm)',
              whiteSpace: 'pre-wrap'
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#A5B4FC', fontSize: '12px' }}>
            <Sparkles size={14} className="animate-spin" />
            <span>Nexorux IA analizando datos del tenant...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-sidebar)'
      }}>
        <form
          onSubmit={e => { e.preventDefault(); handleSend(); }}
          style={{ display: 'flex', gap: '8px' }}
        >
          <input
            type="text"
            className="input-field"
            placeholder="Pregunta a la IA sobre métricas o personal..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading || !input.trim()}
            style={{ padding: '0 14px' }}
          >
            <Send size={14} />
          </button>
        </form>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
          La IA respeta estrictamente los permisos del rol activo (RBAC).
        </div>
      </div>
    </div>
  );
};
