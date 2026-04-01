import { X } from 'lucide-react';
import { useTabStore } from '../store/useTabStore';

const TabBar = () => {
  const tabs = useTabStore((state) => state.tabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const setActiveTab = useTabStore((state) => state.setActiveTab);
  const removeTab = useTabStore((state) => state.removeTab);

  return (
    <div className="tab-bar">
      <div className="tab-strip">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-close" role="button" tabIndex={-1} onClick={(event) => {
              event.stopPropagation();
              void removeTab(tab.id);
            }}>
              <X size={12} />
            </span>
            <span className="tab-title">{tab.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabBar;
