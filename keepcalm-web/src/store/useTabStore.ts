import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from '../utils/runtime';
import {
  getInternalPageTitle,
  isInternalPage,
  normalizeUserInput,
  START_PAGE_URL,
} from '../utils/navigation';

export interface Tab {
  id: string;
  url: string;
  title: string;
  isLoading: boolean;
  isInternal: boolean;
  hasWebview: boolean;
  favicon?: string;
  partition: string;
}

export interface PrivacyStats {
  blocked_requests: number;
  blocked_top_level_navigations: number;
  last_blocked_url: string | null;
  updated_at_unix_ms: number;
}

const DEFAULT_PRIVACY_STATS: PrivacyStats = {
  blocked_requests: 0,
  blocked_top_level_navigations: 0,
  last_blocked_url: null,
  updated_at_unix_ms: 0,
};

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  privacyStats: PrivacyStats;
  hasHydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  ensureInitialTab: () => Promise<void>;
  restoreSessionWebviews: () => Promise<void>;
  addTab: (url?: string) => Promise<void>;
  removeTab: (id: string) => Promise<void>;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  applyPrivacyStats: (stats: PrivacyStats) => void;
  refreshPrivacyStats: () => Promise<void>;
  clearPrivacyStats: () => Promise<void>;
  navigate: (input: string) => Promise<void>;
  navigateBack: () => Promise<void>;
  navigateForward: () => Promise<void>;
  reloadActiveTab: () => Promise<void>;
}

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      privacyStats: DEFAULT_PRIVACY_STATS,
      hasHydrated: false,
      setHydrated: (hydrated) => set({ hasHydrated: hydrated }),

      ensureInitialTab: async () => {
        if (get().tabs.length > 0) {
          const activeStillExists = get().tabs.some((tab) => tab.id === get().activeTabId);
          if (!activeStillExists) {
            set({ activeTabId: get().tabs[0]?.id ?? null });
          }
          return;
        }

        await get().addTab();
      },

      restoreSessionWebviews: async () => {
        if (!isTauriRuntime()) {
          return;
        }

        const tabsToRestore = get().tabs.filter((tab) => !tab.isInternal);
        for (const tab of tabsToRestore) {
          await ensureWebviewForTab({
            ...tab,
            hasWebview: false,
            isLoading: true,
          });
        }
      },

      addTab: async (url = START_PAGE_URL) => {
        const target = normalizeUserInput(url);
        const id = crypto.randomUUID();
        const partition = `tab-${id}`;
        console.log(`[KeepCalm] Store: Adicionando aba ${id} (${url})`);

        const newTab: Tab = {
          id,
          url: target.url,
          title: target.isInternal ? getInternalPageTitle() : 'Loading...',
          isLoading: !target.isInternal,
          isInternal: target.isInternal,
          hasWebview: false,
          partition,
        };

        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: id,
        }));

        if (!target.isInternal) {
          await ensureWebviewForTab(newTab);
        }
      },

      removeTab: async (id) => {
        console.log(`[KeepCalm] Store: Solicitando remoção da aba ${id}`);
        const tab = get().tabs.find((item) => item.id === id);

        if (tab?.hasWebview && isTauriRuntime()) {
          try {
            await invoke('close_webview', { id });
          } catch (error) {
            console.error('Failed to close webview:', error);
          }
        }

        const currentTabs = get().tabs;
        const filteredTabs = currentTabs.filter((item) => item.id !== id);

        if (filteredTabs.length === 0) {
          const fallback = createInternalTab();
          set({
            tabs: [fallback],
            activeTabId: fallback.id,
          });
          return;
        }

        const currentIndex = currentTabs.findIndex((item) => item.id === id);
        const nextActive =
          get().activeTabId === id
            ? filteredTabs[Math.max(0, currentIndex - 1)]?.id ?? filteredTabs[0].id
            : get().activeTabId;

        set({
          tabs: filteredTabs,
          activeTabId: nextActive,
        });
      },

      setActiveTab: (id) => {
        set({ activeTabId: id });
      },

      updateTab: (id, updates) => {
        set((state) => ({
          tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, ...updates } : tab)),
        }));
      },

      applyPrivacyStats: (stats) => {
        set({ privacyStats: stats });
      },

      refreshPrivacyStats: async () => {
        if (!isTauriRuntime()) {
          set({ privacyStats: DEFAULT_PRIVACY_STATS });
          return;
        }

        try {
          const stats = await invoke<PrivacyStats>('get_privacy_stats');
          set({ privacyStats: stats });
        } catch (error) {
          console.error('Failed to refresh privacy stats:', error);
        }
      },

      clearPrivacyStats: async () => {
        if (!isTauriRuntime()) {
          set({ privacyStats: DEFAULT_PRIVACY_STATS });
          return;
        }

        try {
          const stats = await invoke<PrivacyStats>('clear_privacy_stats');
          set({ privacyStats: stats });
        } catch (error) {
          console.error('Failed to clear privacy stats:', error);
        }
      },

      navigate: async (input) => {
        const { activeTabId, tabs, updateTab } = get();

        if (!activeTabId) {
          return;
        }

        const currentTab = tabs.find((tab) => tab.id === activeTabId);
        if (!currentTab) {
          return;
        }

        const target = normalizeUserInput(input);

        if (target.isInternal) {
          if (currentTab.hasWebview && isTauriRuntime()) {
            try {
              await invoke('close_webview', { id: currentTab.id });
            } catch (error) {
              console.error('Failed to close webview before showing start page:', error);
            }
          }

          updateTab(currentTab.id, {
            url: START_PAGE_URL,
            title: getInternalPageTitle(),
            isLoading: false,
            isInternal: true,
            hasWebview: false,
          });
          return;
        }

        updateTab(currentTab.id, {
          url: target.url,
          title: currentTab.hasWebview ? currentTab.title : 'Loading...',
          isLoading: true,
          isInternal: false,
        });

        if (!isTauriRuntime()) {
          return;
        }

        try {
          if (currentTab.hasWebview) {
            await invoke('update_webview_url', { id: currentTab.id, url: target.url });
          } else {
            await ensureWebviewForTab({
              ...currentTab,
              url: target.url,
              isInternal: false,
              isLoading: true,
            });
          }
        } catch (error) {
          console.error('Failed to navigate:', error);
          updateTab(currentTab.id, { isLoading: false });
        }
      },

      navigateBack: async () => {
        const activeTab = getActiveExternalTab(get());
        if (!activeTab || !isTauriRuntime()) {
          return;
        }

        try {
          get().updateTab(activeTab.id, { isLoading: true });
          await invoke('go_back_webview', { id: activeTab.id });
        } catch (error) {
          console.error('Failed to go back:', error);
          get().updateTab(activeTab.id, { isLoading: false });
        }
      },

      navigateForward: async () => {
        const activeTab = getActiveExternalTab(get());
        if (!activeTab || !isTauriRuntime()) {
          return;
        }

        try {
          get().updateTab(activeTab.id, { isLoading: true });
          await invoke('go_forward_webview', { id: activeTab.id });
        } catch (error) {
          console.error('Failed to go forward:', error);
          get().updateTab(activeTab.id, { isLoading: false });
        }
      },

      reloadActiveTab: async () => {
        const activeTab = getActiveExternalTab(get());
        if (!activeTab) {
          return;
        }

        if (!isTauriRuntime()) {
          get().updateTab(activeTab.id, { isLoading: false });
          return;
        }

        try {
          get().updateTab(activeTab.id, { isLoading: true });
          await invoke('reload_webview', { id: activeTab.id });
        } catch (error) {
          console.error('Failed to reload tab:', error);
          get().updateTab(activeTab.id, { isLoading: false });
        }
      },
    }),
    {
      name: 'keepcalm-tab-session',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tabs: state.tabs.map((tab) => ({
          ...tab,
          hasWebview: false,
          isLoading: false,
        })),
        activeTabId: state.activeTabId,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to restore tab session:', error);
        }
        state?.setHydrated(true);
      },
    },
  ),
);

function createInternalTab(): Tab {
  const id = crypto.randomUUID();

  return {
    id,
    url: START_PAGE_URL,
    title: getInternalPageTitle(),
    isLoading: false,
    isInternal: true,
    hasWebview: false,
    partition: `tab-${id}`,
  };
}

async function ensureWebviewForTab(tab: Tab): Promise<void> {
  if (!isTauriRuntime() || tab.isInternal) {
    return;
  }

  try {
    console.log(`[KeepCalm] Store: Invocando 'create_tab_webview' para ${tab.id}`);
    await invoke('create_tab_webview', {
      id: tab.id,
      url: tab.url,
      partition: tab.partition,
    });

    useTabStore.getState().updateTab(tab.id, {
      hasWebview: true,
      isInternal: false,
      isLoading: true,
    });
  } catch (error) {
    console.error('Failed to create webview:', error);
    useTabStore.getState().updateTab(tab.id, {
      hasWebview: false,
      isLoading: false,
    });
  }
}

function getActiveExternalTab(state: Pick<TabState, 'tabs' | 'activeTabId'>): Tab | null {
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;

  if (!activeTab || isInternalPage(activeTab.url)) {
    return null;
  }

  return activeTab;
}
