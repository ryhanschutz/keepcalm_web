import React from 'react';
import { ShieldCheck, Globe } from 'lucide-react';
import { useTabStore } from '../store/useTabStore';

const StatusBar: React.FC = () => {
  const tabs = useTabStore((state) => state.tabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const privacyStats = useTabStore((state) => state.privacyStats);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

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
        userSelect: 'none',
        zIndex: 1001
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span style={{ fontWeight: 500, color: 'var(--kc-text-primary)', opacity: 0.8 }}>Nocturnal Engine v4.0</span>
        <div style={{ width: '1px', height: '10px', background: 'var(--kc-border-main)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Globe size={10} />
          <span>{activeTab?.title || 'Pronto'}</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={12} color="var(--kc-success)" />
          <span style={{ fontWeight: 500, color: 'var(--kc-success)', opacity: 0.9 }}>
            KeepCalm Proteção Ativa
          </span>
        </div>
        <div style={{ width: '1px', height: '10px', background: 'var(--kc-border-main)' }} />
        <span style={{ color: privacyStats.blocked_requests > 0 ? 'var(--kc-accent-primary)' : 'inherit' }}>
          {privacyStats.blocked_requests} recursos bloqueados
        </span>
      </div>
    </div>
  );
};

export default StatusBar;
