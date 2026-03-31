import React, { useEffect, useRef } from 'react';
import { useTabStore } from '../store/useTabStore';
import { invoke } from '@tauri-apps/api/core';

export const ContentArea: React.FC = () => {
  const { tabs, activeTabId } = useTabStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const containerRef = useRef<HTMLDivElement>(null);

  // Efeito para reposicionar a webview quando o container mudar de tamanho ou a aba ativa mudar
  useEffect(() => {
    if (!activeTabId || !containerRef.current) return;

    const updatePosition = async () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      try {
        await invoke('reposition_webview', {
          id: activeTabId,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
      } catch (error) {
        console.error('Erro ao reposicionar webview:', error);
      }
    };

    const observer = new ResizeObserver(() => {
      updatePosition();
    });

    observer.observe(containerRef.current);
    updatePosition(); // Chamada inicial

    return () => {
      observer.disconnect();
    };
  }, [activeTabId]);

  if (!activeTab || activeTab.url === 'about:blank') {
    return (
      <div className="content-area" ref={containerRef}>
        <div className="welcome-screen">
          <div className="welcome-content">
            <h1 className="welcome-title">KeepCalm Web</h1>
            <p className="welcome-subtitle">Navegação sem rastros. Privacidade absoluta.</p>
            
            <div className="welcome-grid">
              <div className="welcome-card">
                <h3>Partições Isoladas</h3>
                <p>Cada aba possui seu próprio armazenamento, cookies e cache.</p>
              </div>
              <div className="welcome-card">
                <h3>Bypass de Rede</h3>
                <p>Otimizado para conexões DoH, Tor e Relay integrados.</p>
              </div>
              <div className="welcome-card">
                <h3>Sem Telemetria</h3>
                <p>Nenhum dado é enviado para servidores externos. Jamais.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-area" ref={containerRef}>
      <div className="view-container">
        <div className="loading-placeholder">
          <div className="loading-spinner"></div>
          <span>Carregando {activeTab.url}...</span>
        </div>
      </div>
    </div>
  );
};
