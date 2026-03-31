import React from 'react';
import { useTabStore } from '../store/useTabStore';

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab } = useTabStore();

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.favicon ? (
            <img src={tab.favicon} alt="" width={16} height={16} />
          ) : (
            <div className="tab-favicon-placeholder" />
          )}
          
          <span className="truncate" style={{ flex: 1 }}>
            {tab.title}
          </span>
          
          <button 
            className="tab-close-btn" 
            onClick={(e) => {
              e.stopPropagation();
              removeTab(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
      
      <button className="new-tab-btn" onClick={() => addTab()}>
        +
      </button>
    </div>
  );
};
