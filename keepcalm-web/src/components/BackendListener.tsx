import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useTabStore } from '../store/useTabStore';
import { useDownloadStore } from '../store/useDownloadStore';
import type { PrivacyStats } from '../store/useTabStore';
import { isTauriRuntime } from '../utils/runtime';

export const BackendListener: React.FC = () => {
  const { updateTab, applyPrivacyStats, refreshPrivacyStats } = useTabStore();
  const { addDownload, updateProgress, finishDownload, cancelDownload } = useDownloadStore();

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

    // Download Events
    const unlistenDownloadStarted = listen<{ id: string; filename: string; total_size?: number; path?: string }>('download-started', (event) => {
      addDownload(event.payload.id, event.payload.filename, event.payload.total_size, event.payload.path);
    });

    const unlistenDownloadProgress = listen<{ id: string; downloaded: number; total?: number }>('download-progress', (event) => {
      updateProgress(event.payload.id, event.payload.downloaded, event.payload.total);
    });

    const unlistenDownloadFinished = listen<{ id: string; success: boolean }>('download-finished', (event) => {
      if (event.payload.success) {
        finishDownload(event.payload.id);
        return;
      }
      cancelDownload(event.payload.id);
    });

    const unlistenDownloadCanceled = listen<string>('download-canceled', (event) => {
      cancelDownload(event.payload);
    });

    return () => {
      unlistenUrl.then((fn) => fn());
      unlistenTitle.then((fn) => fn());
      unlistenStart.then((fn) => fn());
      unlistenFinished.then((fn) => fn());
      unlistenPrivacyStats.then((fn) => fn());
      unlistenDownloadStarted.then((fn) => fn());
      unlistenDownloadProgress.then((fn) => fn());
      unlistenDownloadFinished.then((fn) => fn());
      unlistenDownloadCanceled.then((fn) => fn());
    };
  }, [updateTab, applyPrivacyStats, refreshPrivacyStats, addDownload, updateProgress, finishDownload, cancelDownload]);

  return null;
};
