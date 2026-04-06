import { ShieldAlert, ShieldCheck } from 'lucide-react';

const StatusBar = () => {
  return (
    <div
      style={{
        height: '24px',
        background: 'var(--kc-bg-toolbar)',
        borderTop: '1px solid var(--kc-border-main)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        fontSize: '11px',
        color: 'var(--kc-text-secondary)',
        flexShrink: 0,
        userSelect: 'none'
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ fontWeight: 500, color: 'var(--kc-text-primary)', opacity: 0.8 }}>Nocturnal Engine v4.0</span>
        <div style={{ width: '1px', height: '10px', background: 'var(--kc-border-main)' }} />
        <span>Pronto</span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={12} color="var(--kc-success)" />
          <span style={{ fontWeight: 500, color: 'var(--kc-success)', opacity: 0.9 }}>Conexão Segura</span>
        </div>
        <div style={{ width: '1px', height: '10px', background: 'var(--kc-border-main)' }} />
        <span>0 trackers detectados</span>
      </div>
    </div>
  );
};

export default StatusBar;
