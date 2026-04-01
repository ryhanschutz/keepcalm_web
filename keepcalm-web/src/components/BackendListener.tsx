import React, { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useTabStore } from '../store/useTabStore';
import { isTauriRuntime } from '../utils/runtime';

export const BackendListener: React.FC = () => {
  const { updateTab } = useTabStore();

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    // Escutar mudança de URL (redirecionamentos, cliques em links)
    const unlistenUrl = listen<[string, string]>('webview-url-change', (event) => {
      const [id, url] = event.payload;
      updateTab(id, { url });
    });

    // Escutar mudança de título
    const unlistenTitle = listen<[string, string]>('webview-title-change', (event) => {
      const [id, title] = event.payload;
      updateTab(id, { title });
    });

    // Escutar início de carregamento
    const unlistenStart = listen<string>('webview-load-started', (event) => {
      const id = event.payload;
      updateTab(id, { isLoading: true });
    });

    // Escutar fim de carregamento
    const unlistenFinished = listen<string>('webview-load-finished', (event) => {
      // Opcional: tratar URL final do evento
      console.log('Carregamento finalizado:', event.payload);
    });

    return () => {
      unlistenUrl.then(f => f());
      unlistenTitle.then(f => f());
      unlistenStart.then(f => f());
      unlistenFinished.then(f => f());
    };
  }, [updateTab]);

  return null; // Componente invisível de lógica
};
