import React, { useState, useEffect } from 'react';
import { Shield, Globe, Lock, Terminal, X, CheckCircle, Wifi, Cpu } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import './NetworkSettings.css';

interface NetworkSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NetworkStatus {
  profile: string;
  bypass_active: boolean;
  active_layer: string;
  connected: boolean;
  latency_ms: number;
}

export const NetworkSettings: React.FC<NetworkSettingsProps> = ({ isOpen, onClose }) => {
  const [profile, setProfile] = useState('Auto');
  const [bridges, setBridges] = useState('');
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([
    '[System] Network engine initialized',
    '[Discovery] Bypassing restrictions...',
    '[Bypass] Smart Fallback active'
  ]);

  useEffect(() => {
    if (isOpen) {
      updateStatus();
      const interval = setInterval(updateStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const updateStatus = async () => {
    try {
      const currentStatus = await invoke<NetworkStatus>('get_network_status');
      setStatus(currentStatus);
      // Simular novos logs baseados no status
      if (currentStatus.connected) {
        setLogs(prev => [...prev.slice(-4), `[Status] Connected via ${currentStatus.active_layer}`]);
      }
    } catch (e) {
      console.error("Erro ao obter status da rede", e);
    }
  };

  const handleApply = async () => {
    try {
      // TODO: Implementar invoke para salvar bypass_mode
      await invoke('run_network_probe');
      onClose();
    } catch (e) {
      console.error("Erro ao aplicar configurações", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="network-settings-overlay">
      <div className="network-settings-modal">
        <header className="settings-header">
          <div className="header-title">
            <Shield className="icon-blue" size={20} />
            <h2>Configurações de Rede & Stealth</h2>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="settings-content">
          <section className="settings-section">
            <div className="status-grid">
              <div className="status-item">
                <label>Status</label>
                <div className={`status-value ${status?.connected ? 'connected' : 'disconnected'}`}>
                  {status?.connected ? 'Protegido' : 'Desconectado'}
                </div>
              </div>
              <div className="status-item">
                <label>Camada Ativa</label>
                <div className="status-value">{status?.active_layer || 'Nenhuma'}</div>
              </div>
              <div className="status-item">
                <label>Latência</label>
                <div className="status-value">{status?.latency_ms || 0}ms</div>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <label>Perfil de Bypass</label>
            <div className="profile-grid">
              <button 
                className={`profile-card ${profile === 'Auto' ? 'active' : ''}`}
                onClick={() => setProfile('Auto')}
              >
                <Globe size={24} />
                <div className="card-info">
                  <span>Smart Auto</span>
                  <p>Muda camadas dinamicamente</p>
                </div>
              </button>

              <button 
                className={`profile-card ${profile === 'Tor' ? 'active' : ''}`}
                onClick={() => setProfile('Tor')}
              >
                <Lock size={24} />
                <div className="card-info">
                  <span>Tor Stealth</span>
                  <p>Privacidade máxima</p>
                </div>
              </button>

              <button 
                className={`profile-card ${profile === 'TorBridge' ? 'active' : ''}`}
                onClick={() => setProfile('TorBridge')}
              >
                <Cpu size={24} />
                <div className="card-info">
                  <span>Tor Bridge</span>
                  <p>Burlar bloqueios de rede</p>
                </div>
              </button>

              <button 
                className={`profile-card ${profile === 'Direct' ? 'active' : ''}`}
                onClick={() => setProfile('Direct')}
              >
                <Wifi size={24} />
                <div className="card-info">
                  <span>Conexão Direta</span>
                  <p>Sem ofuscação (Mais rápido)</p>
                </div>
              </button>
            </div>
          </section>

          <section className="settings-section">
            <div className="section-header">
              <label>Custom Bridges (obfs4)</label>
              <span className="badge-beta">PRO</span>
            </div>
            <textarea 
              placeholder="Cole aqui suas bridges personalizadas..."
              value={bridges}
              onChange={(e) => setBridges(e.target.value)}
              className="bridge-input"
            />
          </section>

          <section className="settings-section logs-section">
            <div className="section-header">
              <label><Terminal size={14} /> Network Engine Logs</label>
            </div>
            <div className="logs-container">
              {logs.map((log, i) => (
                <div key={i} className="log-line">{log}</div>
              ))}
            </div>
          </section>
        </div>

        <footer className="settings-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleApply}>
            <CheckCircle size={16} />
            Salvar e Reconectar
          </button>
        </footer>
      </div>
    </div>
  );
};
