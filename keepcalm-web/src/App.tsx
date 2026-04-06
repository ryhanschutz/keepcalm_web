import React, { useState, useEffect, useRef } from 'react';
import HeaderBar from './components/HeaderBar';
import ContentArea from './components/ContentArea';
import StatusBar from './components/StatusBar';
import { BackendListener } from './components/BackendListener';
import { NetworkSettings } from './components/NetworkSettings';
import { PrivacyPanel } from './components/PrivacyPanel';
import StartPage from './components/StartPage';
import { useTabStore } from './store/useTabStore';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isRegistered, register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { isTauriRuntime } from './utils/runtime';

const QUICK_SHORTCUT = 'Ctrl+Shift+K';
const HIDE_FROM_SWITCHER_KEY = 'kc-hide-from-task-switcher';
const QUICK_SHORTCUT_KEY = 'kc-quick-shortcut-enabled';

const App: React.FC = () => {
  const [isNetworkSettingsOpen, setIsNetworkSettingsOpen] = useState(false);
  const [isPrivacyPanelOpen, setIsPrivacyPanelOpen] = useState(false);
  const { tabs, activeTabId, hasHydrated, ensureInitialTab, restoreSessionWebviews } = useTabStore();
  const mainRef = useRef<HTMLElement>(null);
  const bootstrappedRef = useRef(false);

  const applyStealthPreferences = async (prefs?: {
    hideFromTaskSwitcher: boolean;
    quickShortcutEnabled: boolean;
  }) => {
    if (!isTauriRuntime()) {
      return;
    }

    const hideFromTaskSwitcher =
      prefs?.hideFromTaskSwitcher ??
      (localStorage.getItem(HIDE_FROM_SWITCHER_KEY) === null
        ? true
        : localStorage.getItem(HIDE_FROM_SWITCHER_KEY) === 'true');
    const quickShortcutEnabled =
      prefs?.quickShortcutEnabled ??
      (localStorage.getItem(QUICK_SHORTCUT_KEY) === null
        ? true
        : localStorage.getItem(QUICK_SHORTCUT_KEY) === 'true');

    const window = getCurrentWindow();
    await window.setSkipTaskbar(hideFromTaskSwitcher);

    const alreadyRegistered = await isRegistered(QUICK_SHORTCUT);
    if (quickShortcutEnabled && !alreadyRegistered) {
      await register(QUICK_SHORTCUT, async () => {
        const win = getCurrentWindow();
        const visible = await win.isVisible();
        if (visible) {
          await win.hide();
          return;
        }
        await win.show();
        await win.setFocus();
      });
    } else if (!quickShortcutEnabled && alreadyRegistered) {
      await unregister(QUICK_SHORTCUT);
    }
  };

  // Inicializa a sessão restaurando abas persistidas e webviews externas.
  useEffect(() => {
    if (!hasHydrated || bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;

    void (async () => {
      await ensureInitialTab();
      await restoreSessionWebviews();
    })();
  }, [hasHydrated, ensureInitialTab, restoreSessionWebviews]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    void applyStealthPreferences();

    return () => {
      void unregister(QUICK_SHORTCUT).catch(() => undefined);
    };
  }, []);

  // Sincronizar posição da WebView com o container React
  useEffect(() => {
    if (!activeTabId || !mainRef.current) return;

    const updateWebViewPosition = () => {
      if (!mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      
      // Chamar Rust para reposicionar a WebView nativa
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
    updateWebViewPosition(); 

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
      <HeaderBar onTogglePrivacyPanel={() => setIsPrivacyPanelOpen(prev => !prev)} />
      
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
      
      <BackendListener />
      
      <PrivacyPanel
        isOpen={isPrivacyPanelOpen}
        onClose={() => setIsPrivacyPanelOpen(false)}
        onOpenNetworkSettings={() => setIsNetworkSettingsOpen(true)}
      />
      
      <NetworkSettings
        isOpen={isNetworkSettingsOpen}
        onClose={() => setIsNetworkSettingsOpen(false)}
        onStealthPreferencesChanged={(prefs) => {
          void applyStealthPreferences(prefs);
        }}
      />
    </div>
  );
};

export default App;
