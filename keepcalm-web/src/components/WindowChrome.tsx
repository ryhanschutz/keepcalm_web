import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTabStore } from '../store/useTabStore';

const appWindow = getCurrentWindow();

export const WindowChrome: React.FC = () => {
  const activeTabId = useTabStore((state) => state.activeTabId);
  const activeTab = useTabStore((state) => 
    state.tabs.find((t) => t.id === activeTabId)
  );

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  return (
    <div className="window-chrome" data-tauri-drag-region>
      <div className="flex items-center gap-2" style={{ pointerEvents: 'none' }}>
        <img src="/favicon.ico" alt="KC" width={16} height={16} />
        <span style={{ fontWeight: 'bold' }}>KeepCalm Web</span>
      </div>
      
      <div className="window-chrome-title truncate">
        {activeTab?.title || 'KeepCalm Web Browser'}
      </div>

      <div className="window-controls">
        <button className="window-control-btn" onClick={handleMinimize}>
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="10" height="1" fill="currentColor"/>
          </svg>
        </button>
        <button className="window-control-btn" onClick={handleMaximize}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor"/>
          </svg>
        </button>
        <button className="window-control-btn close" onClick={handleClose}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>
      </div>
    </div>
  );
};
