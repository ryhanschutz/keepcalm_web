import React, { useState, useEffect } from 'react';
import { useTabStore } from '../store/useTabStore';

export const Toolbar: React.FC = () => {
  const { tabs, activeTabId, updateTab } = useTabStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [urlInput, setUrlInput] = useState(activeTab?.url || '');

  useEffect(() => {
    if (activeTab) {
      setUrlInput(activeTab.url);
    }
  }, [activeTab?.url]);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let targetUrl = urlInput.trim();
    if (!targetUrl.includes('://') && !targetUrl.startsWith('about:')) {
      targetUrl = `https://${targetUrl}`;
    }
    if (activeTabId) {
      updateTab(activeTabId, { url: targetUrl });
    }
  };

  return (
    <div className="toolbar">
      <button className="toolbar-btn" disabled={!activeTab?.canGoBack}>
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M10 12.796V3.204L4.519 8 10 12.796zm-.659-8.914L5.433 8l3.908 4.118V3.882z"/>
        </svg>
      </button>
      <button className="toolbar-btn" disabled={!activeTab?.canGoForward}>
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 12.796V3.204L11.481 8 6 12.796zm.659-8.914L10.567 8l-3.908 4.118V3.882z"/>
        </svg>
      </button>
      <button className="toolbar-btn">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 3a5 5 0 1 0 5 5h1a6 6 0 1 1-6-6V1L5 3.5 8 6V3z"/>
        </svg>
      </button>
      <button className="toolbar-btn">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 2 8h1v7h10V8h1a.5.5 0 0 0 .354-.854l-6-6zM7.5 2.207 12.5 7.207V14H3.5V7.207l5-5z"/>
        </svg>
      </button>

      <div className="separator-v" />

      <form className="address-bar" onSubmit={handleNavigate}>
        <div className="security-icon">
          {activeTab?.isSecure ? (
            <svg viewBox="0 0 16 16" fill="#2A6B3C" width="14" height="14">
              <path d="M8 1a2 2 0 0 1 2 2v2H6V3a2 2 0 0 1 2-2zm3 4V3a3 3 0 0 0-6 0v2H2v10h12V5h-3zM3 6h10v8H3V6z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" fill="#555" width="14" height="14">
              <path d="M8 1a2 2 0 0 1 2 2v2H6V3a2 2 0 0 1 2-2zm3 4V3a3 3 0 0 0-6 0v2H2v10h12V5h-3zM3 6h10v8H3V6z"/>
            </svg>
          )}
        </div>
        <input 
          type="text" 
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </form>

      <div className="separator-v" />

      <button className="toolbar-btn kc-privacy">
        <img src="/favicon.ico" alt="" width="20" height="20" />
      </button>
      <button className="toolbar-btn">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
        </svg>
      </button>
    </div>
  );
};
