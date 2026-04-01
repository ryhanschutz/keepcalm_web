import { Globe, Pencil, Shield } from 'lucide-react';
import { useTabStore } from '../store/useTabStore';

const StatusBar = () => {
  const tabs = useTabStore((state) => state.tabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const privacyStats = useTabStore((state) => state.privacyStats);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

  return (
    <footer className="status-bar">
      <div className="status-inline">
        <Globe size={12} />
        <span>{activeTab?.isInternal ? 'Start Page' : activeTab?.url ?? 'Ready'}</span>
      </div>

      <div className="status-trailing">
        <div className="status-inline status-inline-privacy">
          <Shield size={12} />
          <span>{privacyStats.blocked_requests} blocked</span>
        </div>

        <button className="customize-button" type="button" aria-label="Customize start page">
          <Pencil size={14} />
        </button>
      </div>
    </footer>
  );
};

export default StatusBar;
