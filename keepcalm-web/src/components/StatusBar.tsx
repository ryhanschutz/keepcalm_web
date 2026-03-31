import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Shield, ShieldCheck, Globe, Zap, Activity } from 'lucide-react';
import './StatusBar.css';

interface NetworkStatus {
  profile: 'Open' | 'DnsBased' | 'SniFiltered' | 'DpiActive' | 'Restricted' | 'Unknown';
  active_layer: string;
  latency_ms: number;
}

interface StatusBarProps {
  onOpenNetworkSettings?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({ onOpenNetworkSettings }) => {
  const [status, setStatus] = useState<NetworkStatus>({
    profile: 'Unknown',
    active_layer: 'Detectando...',
    latency_ms: 0
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const result = await invoke<NetworkStatus>('get_network_status');
        setStatus(result);
      } catch (error) {
        console.error('Falha ao obter status de rede:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const getProfileLabel = (p: string) => {
    switch (p) {
      case 'Open': return 'Conexão Direta (Segura)';
      case 'DnsBased': return 'DNS Criptografado';
      case 'SniFiltered': return 'Tor Stealth Ativo';
      case 'DpiActive': return 'Tor High-Resilience';
      default: return 'Proteção Ativa';
    }
  };

  const getProfileIcon = () => {
    switch (status.profile) {
      case 'Open': return <Globe size={14} className="icon-success" />;
      case 'DpiActive': return <ShieldCheck size={14} className="icon-secure" />;
      default: return <Shield size={14} className="icon-info" />;
    }
  };

  return (
    <div className="status-bar">
      <div className="status-left">
        <div className="status-group">
          {getProfileIcon()}
          <span className="status-label">Rede:</span>
          <span className="status-value">{getProfileLabel(status.profile)}</span>
        </div>
        <div className="status-divider" />
        <div className="status-group">
          <Activity size={14} className="icon-muted" />
          <span className="status-label">Camada:</span>
          <span className="status-value highlight">{status.active_layer}</span>
        </div>
      </div>
      
      <div className="status-right">
        <div className="status-group">
          <Zap size={14} className="icon-muted" />
          <span className="status-value">{status.latency_ms}ms</span>
        </div>
        <div className="status-divider" />
        <button 
          onClick={onOpenNetworkSettings}
          className="engine-button"
          title="Configurações do Smart Fallback"
        >
          <span className="engine-label">NETWORK ENGINE v1.1</span>
          <div className={`engine-dot ${status.latency_ms > 0 ? 'active' : ''}`}></div>
        </button>
      </div>
    </div>
  );
};
