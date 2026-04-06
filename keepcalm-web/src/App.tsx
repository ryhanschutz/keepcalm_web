import React, { useState, useEffect, useRef } from 'react';
import HeaderBar from './components/HeaderBar';
import ContentArea from './components/ContentArea';
import StatusBar from './components/StatusBar';
import { BackendListener } from './components/BackendListener';
import { NetworkSettings } from './components/NetworkSettings';
import StartPage from './components/StartPage';
import { useTabStore } from './store/useTabStore';
import { invoke } from '@tauri-apps/api/core';

const App: React.FC = () => {
  const [isNetworkSettingsOpen, setIsNetworkSettingsOpen] = useState(false);
  const { tabs, activeTabId, addTab } = useTabStore();
  const mainRef = useRef<HTMLElement>(null);

  // Inicializar primeira aba se estiver vazio
  useEffect(() => {
    if (tabs.length === 0) {
      addTab(''); // Abre a StartPage inicialmente
    }
  }, [tabs.length, addTab]);

  // Sincronizar posição da WebView com o container React
  useEffect(() => {
    if (!activeTabId || !mainRef.current) return;

    const updateWebViewPosition = () => {
      if (!mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      
      // Chamar Rust para reposicionar a WebView nativa
      // Multiplicamos pelo devicePixelRatio para garantir precisão em telas High DPI
      const scale = window.devicePixelRatio || 1;
      
      invoke('reposition_webview', {
        id: activeTabId,
        x: rect.x * scale,
        y: rect.y * scale,
        width: rect.width * scale,
        height: rect.height * scale
      }).catch(err => console.error('Erro ao reposicionar WebView:', err));
    };

    const observer = new ResizeObserver(() => {
      updateWebViewPosition();
    });

    observer.observe(mainRef.current);
    updateWebViewPosition(); // Chamada inicial

    return () => observer.disconnect();
  }, [activeTabId]);

  const activeTab = tabs.find(t => t.id === activeTabId);
  const showStartPage = activeTab && (activeTab.url === '' || activeTab.url === 'about:blank');

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      width: '100vw',
      background: 'var(--kc-bg-base)',
      overflow: 'hidden'
    }}>
      <HeaderBar />
      
      <main 
        ref={mainRef}
        style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}
      >
        {showStartPage ? (
          <StartPage />
        ) : (
          <ContentArea />
        )}
      </main>

      <StatusBar />
      
      {/* Componentes invisíveis ou modais */}
      <BackendListener />
      <NetworkSettings 
        isOpen={isNetworkSettingsOpen} 
        onClose={() => setIsNetworkSettingsOpen(false)} 
      />
    </div>
  );
};

export default App;
