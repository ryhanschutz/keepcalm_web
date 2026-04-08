import { invoke } from '@tauri-apps/api/core';
import { Lock, ShieldCheck, SlidersHorizontal, X, User, Zap, Globe, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTabStore } from '../store/useTabStore';
import { isTauriRuntime } from '../utils/runtime';

interface PrivacyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNetworkSettings: () => void;
}

interface NetworkStatus {
  active_layer: string;
  latency_ms: number;
}

export const PrivacyPanel = ({ isOpen, onClose, onOpenNetworkSettings }: PrivacyPanelProps) => {
  const tabs = useTabStore((state) => state.tabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const privacyStats = useTabStore((state) => state.privacyStats);
  const clearPrivacyStats = useTabStore((state) => state.clearPrivacyStats);

  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    active_layer: 'Direct',
    latency_ms: 0,
  });

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [tabs, activeTabId],
  );

  const domain = useMemo(() => {
    if (!activeTab || activeTab.isInternal) {
      return 'start.keepcalm';
    }
    try {
      return new URL(activeTab.url).hostname;
    } catch {
      return activeTab.url || 'unknown';
    }
  }, [activeTab]);

  const refreshNetwork = async () => {
    if (!isTauriRuntime()) return;
    try {
      const status = await invoke<NetworkStatus>('get_network_status');
      setNetworkStatus(status);
    } catch (e) {
      console.error('Failed to update network status:', e);
    }
  };

  const clearStats = async () => {
    try {
      if (isTauriRuntime()) {
        await clearPrivacyStats();
        return;
      }
    } catch (e) {
      console.error('Failed to clear stats:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void refreshNetwork();
      const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isTor = networkStatus.active_layer.toLowerCase().includes('tor');

  return (
    <div className="pp-overlay" onClick={onClose}>
      <aside className="pp-panel" onClick={(e) => e.stopPropagation()}>
        <header className="pp-header">
          <div className="pp-title">
            <ShieldCheck size={16} className="text-accent" />
            <span>Site Security</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </header>

        <div className="pp-content">
          <div className="pp-site-hero">
            <div className="pp-favicon-large">
              {domain.charAt(0).toUpperCase()}
            </div>
            <div className="pp-site-info">
              <h3>{domain}</h3>
              <div className="pp-status-tag">
                <Lock size={10} />
                Encrypted Connection
              </div>
            </div>
          </div>

          <div className="pp-stats-row">
            <div className="pp-stat-box">
              <span>Blocked trackers</span>
              <strong>{privacyStats.blocked_requests}</strong>
            </div>
            <div className="pp-stat-box">
              <span>Threats fixed</span>
              <strong>{privacyStats.blocked_top_level_navigations}</strong>
            </div>
          </div>

          <div className="pp-section-label" style={{ fontSize: '10px', color: '#666', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Connection Route
          </div>

          <div className="pp-route-viz">
            <div className="pp-path-line" />
            <div className="pp-node active">
              <div className="pp-node-icon"><User size={14} /></div>
              <span>YOU</span>
            </div>
            <div className={`pp-node ${isTor ? 'active' : ''}`} style={{ color: isTor ? 'var(--kc-accent-primary)' : 'inherit' }}>
              <div className="pp-node-icon">
                {isTor ? <Zap size={14} fill="currentColor" /> : <Globe size={14} />}
              </div>
              <span>{networkStatus.active_layer.toUpperCase()}</span>
            </div>
            <div className="pp-node">
              <div className="pp-node-icon"><Lock size={14} /></div>
              <span>TARGET</span>
            </div>
          </div>

          <div className="pp-actions">
            <button className="pp-btn" onClick={() => { onClose(); onOpenNetworkSettings(); }}>
              <SlidersHorizontal size={14} />
              Advanced Firewall
            </button>
            <button className="pp-btn pp-btn-danger" onClick={clearStats}>
              <Trash2 size={14} />
              Clear Site Data & Stats
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
