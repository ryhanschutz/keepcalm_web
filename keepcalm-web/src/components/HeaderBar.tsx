import React, { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { 
  ArrowLeft, ArrowRight, Shield, Puzzle, Menu, Plus, X, Minus, Square 
} from 'lucide-react';
import logo from '../assets/logo.png';

import { useTabStore } from '../store/useTabStore';

const HeaderBar: React.FC = () => {
  const [appWindow, setAppWindow] = useState<any>(null);
  const [focused, setFocused] = useState(false);
  
  const { tabs, activeTabId, setActiveTab, addTab, removeTab, navigate } = useTabStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const [url, setUrl] = useState(activeTab?.url || '');

  // Sincronizar URL local quando a aba ativa mudar
  useEffect(() => {
    if (activeTab) {
      setUrl(activeTab.url);
    }
  }, [activeTabId, activeTab?.url]);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      setAppWindow(getCurrentWindow());
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      navigate(url);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <header
      data-tauri-drag-region
      style={{
        height: '48px',
        background: 'var(--kc-bg-toolbar)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 4px 0 12px',
        borderBottom: '1px solid var(--kc-border-main)',
        userSelect: 'none',
        gap: '12px',
        flexShrink: 0,
        zIndex: 1000
      }}
    >
      {/* Lado Esquerdo: Marca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'none', minWidth: 'fit-content' }}>
        <img src={logo} alt="Logo" style={{ width: '18px', height: '18px' }} />
        <span style={{ 
          fontSize: '12px', 
          fontWeight: 600, 
          letterSpacing: '0.2px',
          opacity: 0.9,
          color: 'var(--kc-text-primary)',
          whiteSpace: 'nowrap'
        }}>
          KeepCalm
        </span>
      </div>

      {/* Navegação Rápida */}
      <div style={{ display: 'flex', gap: '2px' }}>
        <button style={navBtnStyle}><ArrowLeft size={16} strokeWidth={1.5} /></button>
        <button style={navBtnStyle}><ArrowRight size={16} strokeWidth={1.5} /></button>
      </div>

      {/* Área Central: Abas e URL Integradas (CSD Style) */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        gap: '4px',
        height: '32px',
        overflow: 'hidden'
      }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                height: '32px',
                minWidth: isActive ? '200px' : '140px',
                flex: isActive ? 2 : 1,
                maxWidth: '300px',
                background: isActive ? 'var(--kc-bg-active)' : 'rgba(255,255,255,0.02)',
                borderRadius: 'var(--kc-radius-md)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                border: isActive 
                  ? `1px solid ${focused ? 'var(--kc-accent-primary)' : 'var(--kc-border-main)'}` 
                  : '1px solid transparent',
                position: 'relative'
              }}
            >
              {!isActive ? (
                <span style={{ fontSize: '11px', color: 'var(--kc-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tab.title}
                </span>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '6px' }}>
                  <Shield size={12} color="var(--kc-success)" style={{ flexShrink: 0 }} />
                  <input 
                    type="text" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontFamily: 'var(--kc-font-ui)',
                      fontSize: '12px',
                      color: 'var(--kc-text-primary)',
                      width: '100%',
                    }}
                  />
                </div>
              )}
              
              <button 
                onClick={(e) => { e.stopPropagation(); removeTab(tab.id); }}
                style={{ 
                  background: 'transparent', border: 'none', color: 'var(--kc-text-secondary)', opacity: 0.4, padding: '4px' 
                }}
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
        
        <button 
          onClick={() => addTab()}
          style={{ 
            width: '28px', height: '28px', background: 'transparent', border: 'none', color: 'var(--kc-text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Lado Direito: Ações e Controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <div style={{ display: 'flex', gap: '2px', marginRight: '8px' }}>
          <button style={actionBtnStyle}><Puzzle size={16} strokeWidth={1.2} /></button>
          <button style={actionBtnStyle}><Menu size={18} strokeWidth={1.5} /></button>
        </div>

        <div style={{ width: '1px', height: '16px', background: 'var(--kc-border-main)', margin: '0 4px' }} />

        {/* Window Controls */}
        <div style={{ display: 'flex' }}>
          <button onClick={() => appWindow?.minimize()} style={windowBtnStyle}>
            <Minus size={14} />
          </button>
          <button onClick={() => appWindow?.maximize()} style={windowBtnStyle}>
            <Square size={12} />
          </button>
          <button onClick={() => appWindow?.close()} style={closeBtnStyle}>
            <X size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};

// Styles
const navBtnStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--kc-radius-md)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--kc-text-primary)',
  opacity: 0.6,
  cursor: 'pointer'
};

const actionBtnStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--kc-radius-md)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--kc-text-primary)',
  cursor: 'pointer'
};

const windowBtnStyle: React.CSSProperties = {
  width: '44px',
  height: '48px',
  background: 'transparent',
  border: 'none',
  color: 'var(--kc-text-primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.1s'
};

const closeBtnStyle: React.CSSProperties = {
  ...windowBtnStyle,
  transition: 'all 0.1s'
};

export default HeaderBar;
