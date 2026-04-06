import { invoke } from '@tauri-apps/api/core';
import { Lock, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
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

type PrivacyLevel = 1 | 2 | 3 | 4 | 5;

const LEVELS: Array<{
  id: PrivacyLevel;
  label: string;
  color: string;
}> = [
  { id: 1, label: 'Normal', color: 'level-gray' },
  { id: 2, label: 'Protected', color: 'level-blue' },
  { id: 3, label: 'Anonymous', color: 'level-green' },
  { id: 4, label: 'Via Tor', color: 'level-purple' },
  { id: 5, label: 'Maximum', color: 'level-red' },
];

export const PrivacyPanel = ({ isOpen, onClose, onOpenNetworkSettings }: PrivacyPanelProps) => {
  const tabs = useTabStore((state) => state.tabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const privacyStats = useTabStore((state) => state.privacyStats);
  const navigate = useTabStore((state) => state.navigate);

  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    active_layer: 'Direct',
    latency_ms: 0,
  });

  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>(2);
  const [siteToggles, setSiteToggles] = useState({
    trackers: true,
    fingerprint: true,
    javascript: true,
    thirdPartyCookies: true,
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
      return activeTab.url;
    }
  }, [activeTab]);

  const stealthScore = useMemo(() => {
    let score = 35;

    if (siteToggles.trackers) score += 15;
    if (siteToggles.fingerprint) score += 20;
    if (siteToggles.thirdPartyCookies) score += 10;
    if (privacyStats.blocked_requests > 0) score += 10;
    if (networkStatus.active_layer.toLowerCase().includes('tor')) score += 10;

    return Math.min(score, 100);
  }, [siteToggles, privacyStats.blocked_requests, networkStatus.active_layer]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!isTauriRuntime()) {
      setNetworkStatus({
        active_layer: 'Preview Mode',
        latency_ms: 0,
      });
      return;
    }

    void invoke<NetworkStatus>('get_network_status')
      .then((status) => {
        setNetworkStatus(status);
      })
      .catch((error) => {
        console.error('Failed to load network status for privacy panel:', error);
      });
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="pp-overlay" onClick={onClose}>
      <aside
        className="pp-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Privacy panel"
      >
        <header className="pp-header">
          <div className="pp-title">
            <ShieldCheck size={16} />
            <strong>Privacy</strong>
          </div>
          <button type="button" className="pp-icon-btn" onClick={onClose} aria-label="Close privacy panel">
            <X size={14} />
          </button>
        </header>

        <section className="pp-site">
          <div className="pp-site-main">
            <div className="pp-favicon">{domain.charAt(0).toUpperCase()}</div>
            <div className="pp-site-copy">
              <strong>{domain}</strong>
              <span className="pp-badge">
                <Lock size={12} />
                Secure
              </span>
            </div>
          </div>
        </section>

        <section className="pp-section">
          <span className="pp-label">Privacy Level</span>
          <div className="pp-level-grid">
            {LEVELS.map((level) => (
              <button
                key={level.id}
                type="button"
                className={`pp-level-btn ${privacyLevel === level.id ? 'active' : ''}`}
                onClick={() => setPrivacyLevel(level.id)}
              >
                <span className={`pp-level-dot ${level.color}`} />
                {level.label}
              </button>
            ))}
          </div>
        </section>

        <section className="pp-section">
          <span className="pp-label">Live Stats</span>
          <div className="pp-stats">
            <article className="pp-stat-card">
              <span>Blocked Requests</span>
              <strong>{privacyStats.blocked_requests}</strong>
            </article>
            <article className="pp-stat-card">
              <span>Blocked Navigations</span>
              <strong>{privacyStats.blocked_top_level_navigations}</strong>
            </article>
          </div>
        </section>

        <section className="pp-section">
          <span className="pp-label">Site Rules</span>
          <div className="pp-toggles">
            <ToggleRow
              label="Trackers"
              checked={siteToggles.trackers}
              onChange={(checked) => setSiteToggles((prev) => ({ ...prev, trackers: checked }))}
            />
            <ToggleRow
              label="Fingerprint Protection"
              checked={siteToggles.fingerprint}
              onChange={(checked) => setSiteToggles((prev) => ({ ...prev, fingerprint: checked }))}
            />
            <ToggleRow
              label="JavaScript"
              checked={siteToggles.javascript}
              onChange={(checked) => setSiteToggles((prev) => ({ ...prev, javascript: checked }))}
            />
            <ToggleRow
              label="Third-party Cookies"
              checked={siteToggles.thirdPartyCookies}
              onChange={(checked) =>
                setSiteToggles((prev) => ({ ...prev, thirdPartyCookies: checked }))
              }
            />
          </div>
        </section>

        <section className="pp-section">
          <span className="pp-label">Network Route</span>
          <div className="pp-route">
            <span>You</span>
            <span className="pp-route-arrow">→</span>
            <span>{networkStatus.active_layer}</span>
            <span className="pp-route-arrow">→</span>
            <span>{domain}</span>
            <span className="pp-latency">{networkStatus.latency_ms} ms</span>
          </div>
        </section>

        <section className="pp-section">
          <span className="pp-label">Stealth Check</span>
          <div className="pp-stealth">
            <div className="pp-stealth-score">
              <span>Estimated stealth</span>
              <strong>{stealthScore}%</strong>
            </div>
            <div className="pp-stealth-actions">
              <button type="button" onClick={() => void navigate('https://coveryourtracks.eff.org')}>
                EFF test
              </button>
              <button type="button" onClick={() => void navigate('https://browserleaks.com')}>
                BrowserLeaks
              </button>
              <button type="button" onClick={() => void navigate('https://check.torproject.org')}>
                Tor check
              </button>
            </div>
          </div>
        </section>

        <footer className="pp-footer">
          <button
            type="button"
            className="pp-settings-btn"
            onClick={() => {
              onClose();
              onOpenNetworkSettings();
            }}
          >
            <SlidersHorizontal size={14} />
            Advanced Security Settings
          </button>
        </footer>
      </aside>
    </div>
  );
};

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleRow = ({ label, checked, onChange }: ToggleRowProps) => {
  return (
    <label className="pp-toggle-row">
      <span>{label}</span>
      <button
        type="button"
        className={`pp-toggle ${checked ? 'on' : 'off'}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span className="pp-toggle-thumb" />
      </button>
    </label>
  );
};
