import { ShieldCheck } from 'lucide-react';

const StatusBar = () => {
  return (
    <div
      style={{
        height: '22px',
        background: 'var(--kc-bg-sidebar)',
        borderTop: '1px solid var(--kc-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        fontSize: '11px',
        color: 'var(--kc-text-secondary)',
        flexShrink: 0
      }}
    >
      <div>Concluído</div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>Proteção Forte</span>
        <ShieldCheck size={12} color="var(--kc-success)" />
        <span>0 bloqueados</span>
      </div>
    </div>
  );
};

export default StatusBar;
