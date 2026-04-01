import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from '../utils/runtime';

export interface Tab {
  id: string;
  url: string;
  title: string;
  isLoading: boolean;
  favicon?: string;
  partition: string;
}

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (url?: string) => Promise<void>;
  removeTab: (id: string) => Promise<void>;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  navigate: (url: string) => Promise<void>;
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: async (url = 'about:blank') => {
    const id = crypto.randomUUID();
    const partition = `tab-${id}`;
    
    const newTab: Tab = {
      id,
      url,
      title: url === 'about:blank' ? 'Nova Aba' : 'Carregando...',
      isLoading: url !== 'about:blank',
      partition,
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));

    try {
      if (isTauriRuntime()) {
        await invoke('create_tab_webview', { id, url, partition });
      }
    } catch (error) {
      console.error('Falha ao criar webview no Rust:', error);
    }
  },

  removeTab: async (id) => {
    try {
      if (isTauriRuntime()) {
        await invoke('close_webview', { id });
      }
    } catch (error) {
      console.error('Falha ao fechar webview no Rust:', error);
    }

    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActiveId = state.activeTabId;
      
      if (state.activeTabId === id) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      
      return {
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
  },

  updateTab: (id, updates) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  navigate: async (url) => {
    const { activeTabId, updateTab } = get();
    if (!activeTabId) return;

    updateTab(activeTabId, { url, isLoading: true });
    
    try {
      if (isTauriRuntime()) {
        await invoke('update_webview_url', { id: activeTabId, url });
      } else {
        updateTab(activeTabId, { isLoading: false });
      }
    } catch (error) {
      console.error('Falha ao navegar no Rust:', error);
      updateTab(activeTabId, { isLoading: false });
    }
  },
}));
