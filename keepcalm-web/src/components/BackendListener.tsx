import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useTabStore } from '../store/useTabStore';
import type { PrivacyStats } from '../store/useTabStore';
import { isTauriRuntime } from '../utils/runtime';

export const BackendListener: React.FC = () => {
  const { updateTab, applyPrivacyStats, refreshPrivacyStats } = useTabStore();

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    void refreshPrivacyStats();

    const unlistenUrl = listen<[string, string]>('webview-url-change', (event) => {
      const [id, url] = event.payload;
      updateTab(id, { url, isLoading: true });
    });

    const unlistenTitle = listen<[string, string]>('webview-title-change', (event) => {
      const [id, title] = event.payload;
      updateTab(id, { title });
    });

    const unlistenStart = listen<string>('webview-load-started', (event) => {
      updateTab(event.payload, { isLoading: true });
    });

    const unlistenFinished = listen<[string, string]>('webview-load-finished', (event) => {
      const [id, url] = event.payload;
      updateTab(id, { isLoading: false, url });
    });

    const unlistenPrivacyStats = listen<PrivacyStats>('privacy-stats-updated', (event) => {
      applyPrivacyStats(event.payload);
    });

    return () => {
      unlistenUrl.then((fn) => fn());
      unlistenTitle.then((fn) => fn());
      unlistenStart.then((fn) => fn());
      unlistenFinished.then((fn) => fn());
      unlistenPrivacyStats.then((fn) => fn());
    };
  }, [updateTab, applyPrivacyStats, refreshPrivacyStats]);

  return null;
};
