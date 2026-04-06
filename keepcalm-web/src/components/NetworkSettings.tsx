import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  Cpu,
  Globe,
  Lock,
  Shield,
  Terminal,
  Wifi,
  X,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import './NetworkSettings.css';
import { isTauriRuntime } from '../utils/runtime';

interface NetworkSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onStealthPreferencesChanged?: (prefs: { hideFromTaskSwitcher: boolean; quickShortcutEnabled: boolean }) => void;
}

interface NetworkStatus {
  profile: string;
  bypass_active: boolean;
  active_layer: string;
  connected: boolean;
  latency_ms: number;
}

type NetworkProfile = 'Auto' | 'Tor' | 'TorBridge' | 'Direct';

const PROFILES: Array<{
  key: NetworkProfile;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  {
    key: 'Auto',
    title: 'Smart Auto',
    description: 'Switches layers based on network conditions.',
    icon: Globe,
  },
  {
    key: 'Tor',
    title: 'Tor Stealth',
    description: 'Maximum privacy for sensitive sessions.',
    icon: Lock,
  },
  {
    key: 'TorBridge',
    title: 'Tor Bridge',
    description: 'Bypasses restrictive or filtered networks.',
    icon: Cpu,
  },
  {
    key: 'Direct',
    title: 'Direct',
    description: 'Lowest overhead for trusted environments.',
    icon: Wifi,
  },
];

const HIDE_FROM_SWITCHER_KEY = 'kc-hide-from-task-switcher';
const QUICK_SHORTCUT_KEY = 'kc-quick-shortcut-enabled';

export const NetworkSettings: React.FC<NetworkSettingsProps> = ({
  isOpen,
  onClose,
  onStealthPreferencesChanged,
}) => {
  const [profile, setProfile] = useState<NetworkProfile>('Auto');
  const [bridges, setBridges] = useState('');
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([
    '[system] network engine initialized',
    '[discovery] probing available routes',
    '[bypass] smart fallback enabled',
  ]);
  const [isApplying, setIsApplying] = useState(false);
  const [hideFromTaskSwitcher, setHideFromTaskSwitcher] = useState(true);
  const [quickShortcutEnabled, setQuickShortcutEnabled] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void updateStatus();

    const intervalId = setInterval(() => {
      void updateStatus();
    }, 3000);

    return () => clearInterval(intervalId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const hide = localStorage.getItem(HIDE_FROM_SWITCHER_KEY);
    const shortcut = localStorage.getItem(QUICK_SHORTCUT_KEY);

    setHideFromTaskSwitcher(hide === null ? true : hide === 'true');
    setQuickShortcutEnabled(shortcut === null ? true : shortcut === 'true');
  }, [isOpen]);

  const updateStatus = async () => {
    if (!isTauriRuntime()) {
      setStatus({
        profile,
        bypass_active: false,
        active_layer: 'Preview Mode',
        connected: true,
        latency_ms: 0,
      });
      return;
    }

    try {
      const currentStatus = await invoke<NetworkStatus>('get_network_status');
      setStatus(currentStatus);
      syncProfileWithStatus(currentStatus.active_layer, setProfile);

      if (currentStatus.connected) {
        setLogs((prev) => [
          ...prev.slice(-5),
          `[status] connected via ${currentStatus.active_layer.toLowerCase()}`,
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch network status', error);
    }
  };

  const applyChanges = async () => {
    setIsApplying(true);

    try {
      if (isTauriRuntime()) {
        const updated = await invoke<NetworkStatus>('set_bypass_mode', { mode: profile });
        setStatus(updated);
      }

      setLogs((prev) => [
        ...prev.slice(-5),
        `[apply] profile set to ${profile.toLowerCase()}`,
      ]);
      localStorage.setItem(HIDE_FROM_SWITCHER_KEY, String(hideFromTaskSwitcher));
      localStorage.setItem(QUICK_SHORTCUT_KEY, String(quickShortcutEnabled));
      onStealthPreferencesChanged?.({ hideFromTaskSwitcher, quickShortcutEnabled });
      void updateStatus();
      onClose();
    } catch (error) {
      console.error('Failed to apply network settings', error);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="ns-overlay">
      <div className="ns-modal">
        <header className="ns-header">
          <div className="ns-header-title">
            <Shield size={18} />
            <h2>Security Settings</h2>
          </div>
          <button className="ns-icon-button" type="button" onClick={onClose} aria-label="Close security settings">
            <X size={18} />
          </button>
        </header>

        <div className="ns-content">
          <section className="ns-section">
            <span className="ns-label">Session Status</span>
            <div className="ns-status-grid">
              <article className="ns-status-card">
                <span className="ns-status-title">State</span>
                <strong className={status?.connected ? 'ns-state-ok' : 'ns-state-bad'}>
                  {status?.connected ? 'Protected' : 'Offline'}
                </strong>
              </article>
              <article className="ns-status-card">
                <span className="ns-status-title">Active Layer</span>
                <strong>{status?.active_layer ?? 'None'}</strong>
              </article>
              <article className="ns-status-card">
                <span className="ns-status-title">Latency</span>
                <strong>{status?.latency_ms ?? 0} ms</strong>
              </article>
            </div>
          </section>

          <section className="ns-section">
            <span className="ns-label">Bypass Profile</span>
            <div className="ns-profile-grid">
              {PROFILES.map(({ key, title, description, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  className={`ns-profile-card ${profile === key ? 'active' : ''}`}
                  onClick={() => setProfile(key)}
                >
                  <Icon size={18} />
                  <div className="ns-profile-copy">
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="ns-section">
            <div className="ns-section-header">
              <span className="ns-label">Custom Bridges (obfs4)</span>
              <span className="ns-badge">PRO</span>
            </div>
            <textarea
              value={bridges}
              onChange={(event) => setBridges(event.target.value)}
              placeholder="Paste one bridge per line..."
              className="ns-textarea"
            />
          </section>

          <section className="ns-section">
            <span className="ns-label">
              <Terminal size={13} />
              Engine Logs
            </span>
            <div className="ns-logs">
              {logs.map((line, index) => (
                <code key={`${line}-${index}`}>{line}</code>
              ))}
            </div>
          </section>

          <section className="ns-section">
            <span className="ns-label">Discreet Mode</span>
            <div className="ns-discreet">
              <label className="ns-discreet-row">
                <div>
                  <strong>Hide from task switcher</strong>
                  <p>Attempts to hide KeepCalm from taskbar/Alt-Tab when supported.</p>
                </div>
                <button
                  type="button"
                  className={`ns-switch ${hideFromTaskSwitcher ? 'on' : 'off'}`}
                  onClick={() => setHideFromTaskSwitcher((prev) => !prev)}
                  aria-pressed={hideFromTaskSwitcher}
                >
                  <span />
                </button>
              </label>

              <label className="ns-discreet-row">
                <div>
                  <strong>Quick summon shortcut</strong>
                  <p>Show/hide KeepCalm globally with <code>Ctrl+Shift+K</code>.</p>
                </div>
                <button
                  type="button"
                  className={`ns-switch ${quickShortcutEnabled ? 'on' : 'off'}`}
                  onClick={() => setQuickShortcutEnabled((prev) => !prev)}
                  aria-pressed={quickShortcutEnabled}
                >
                  <span />
                </button>
              </label>
            </div>
          </section>
        </div>

        <footer className="ns-footer">
          <button className="ns-secondary-btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="ns-primary-btn" type="button" onClick={() => void applyChanges()} disabled={isApplying}>
            <CheckCircle size={15} />
            {isApplying ? 'Applying...' : 'Apply & Reconnect'}
          </button>
        </footer>
      </div>
    </div>
  );
};

function syncProfileWithStatus(
  activeLayer: string,
  setProfile: (value: NetworkProfile) => void,
): void {
  const normalized = activeLayer.toLowerCase();

  if (normalized.includes('bridge')) {
    setProfile('TorBridge');
    return;
  }

  if (normalized.includes('tor')) {
    setProfile('Tor');
    return;
  }

  if (normalized.includes('direct')) {
    setProfile('Direct');
    return;
  }

  setProfile('Auto');
}
