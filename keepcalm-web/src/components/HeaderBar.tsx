import React, { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { 
  ArrowLeft, ArrowRight, Shield, Puzzle, Menu, Plus, X, Minus, Square, Star, Terminal 
} from 'lucide-react';
import DownloadIndicator from './DownloadIndicator';
import logo from '../assets/logo.png';

import { useTabStore } from '../store/useTabStore';

interface HeaderBarProps {
  onTogglePrivacyPanel?: () => void;
  onToggleSecurityLab?: () => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({ onTogglePrivacyPanel, onToggleSecurityLab }) => {
  const [appWindow, setAppWindow] = useState<any>(null);
  const [focused, setFocused] = useState(false);
  
  const { 
    tabs, 
    activeTabId, 
    bookmarks,
    setActiveTab, 
    addTab, 
    removeTab, 
    navigate, 
    navigateBack, 
    navigateForward,
    toggleBookmark
  } = useTabStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const [url, setUrl] = useState(activeTab?.url || '');
  const isBookmarked = bookmarks.some(b => b.url === activeTab?.url);

  // Sincronizar URL local quando a aba ativa mudar
  useEffect(() => {
    if (activeTab) {
      setUrl(activeTab.url);
    }
  }, [activeTabId, activeTab?.url]);

  useEffect(() => {
    // No Tauri v2, tentamos obter a janela diretamente
    try {
      const win = getCurrentWindow();
      setAppWindow(win);
    } catch (e) {
      console.error("Falha ao obter janela Tauri:", e);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = (e.target as HTMLInputElement).value.trim();
      if (value) {
        void navigate(value);
      }
    }
  };

  const toggleMaximize = async () => {
    if (!appWindow) return;
    const isMaximized = await appWindow.isMaximized();
    if (isMaximized) {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
    }
  };

  const handleMouseDown = async (e: React.MouseEvent) => {
    // Apenas inicia o arraste se não estiver clicando em botões ou inputs
    if (appWindow && (e.target as HTMLElement).tagName !== 'BUTTON' && (e.target as HTMLElement).tagName !== 'INPUT') {
      await appWindow.startDragging();
    }
  };

  return (
    <header
      onMouseDown={handleMouseDown}
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
        zIndex: 1000,
        cursor: 'default' // Garante cursor padrão para arraste
      }}
    >
      {/* Lado Esquerdo: Marca */}
      <div 
        data-tauri-drag-region 
        style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 'fit-content' }}
      >
        <img src={logo} alt="Logo" style={{ width: '18px', height: '18px', pointerEvents: 'none' }} />
        <span style={{ 
          fontSize: '12px', 
          fontWeight: 600, 
          letterSpacing: '0.2px',
          opacity: 0.9,
          color: 'var(--kc-text-primary)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none'
        }}>
          KeepCalm
        </span>
      </div>

      {/* Navegação Rápida */}
      <div style={{ display: 'flex', gap: '2px', position: 'relative', zIndex: 1001 }}>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => void navigateBack()}
          style={navBtnStyle}
          aria-label="Voltar"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => void navigateForward()}
          style={navBtnStyle}
          aria-label="Avançar"
        >
          <ArrowRight size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Área Central: Abas e URL Integradas (CSD Style) */}
      <div 
        data-tauri-drag-region
        style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '4px',
          height: '48px', // Aumentado para ocupar toda a altura e permitir arraste entre abas
          overflow: 'hidden'
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onMouseDown={(e) => e.stopPropagation()}
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
                position: 'relative',
                zIndex: 1001
              }}
            >
              {!isActive ? (
                <span style={{ fontSize: '11px', color: 'var(--kc-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
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
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => toggleBookmark(tab.url, tab.title)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: isBookmarked ? '#FFD700' : 'var(--kc-text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 4px',
                      transition: 'all 0.2s',
                      opacity: isBookmarked ? 1 : 0.5
                    }}
                    title={isBookmarked ? 'Remover Favorito' : 'Adicionar Favorito'}
                  >
                    <Star size={14} fill={isBookmarked ? '#FFD700' : 'none'} strokeWidth={1.5} />
                  </button>
                </div>
              )}
              
              <button 
                onClick={(e) => { e.stopPropagation(); void removeTab(tab.id); }}
                style={{ 
                  background: 'transparent', border: 'none', color: 'var(--kc-text-secondary)', opacity: 0.4, padding: '4px', cursor: 'pointer'
                }}
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
        
        <button 
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => addTab()}
          style={{ 
            width: '28px', height: '28px', background: 'transparent', border: 'none', color: 'var(--kc-text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, zIndex: 1001
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Lado Direito: Ações e Controles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', zIndex: 1001 }} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: '2px', marginRight: '8px' }}>
          <DownloadIndicator />
          <button style={actionBtnStyle}><Puzzle size={16} strokeWidth={1.2} /></button>
          <button 
            style={actionBtnStyle}
            onClick={onTogglePrivacyPanel}
            title="Privacy Guard"
          >
            <Shield size={18} strokeWidth={1.5} />
          </button>
          <button 
            style={{...actionBtnStyle, color: 'var(--kc-accent-primary)'}}
            onClick={onToggleSecurityLab}
            title="Security Lab"
          >
            <Terminal size={18} strokeWidth={1.5} />
          </button>
          <button 
            style={actionBtnStyle}
          >
            <Menu size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ width: '1px', height: '16px', background: 'var(--kc-border-main)', margin: '0 4px' }} />

        {/* Window Controls */}
        <div style={{ display: 'flex' }}>
          <button onClick={() => appWindow?.minimize()} style={windowBtnStyle} title="Minimizar">
            <Minus size={14} />
          </button>
          <button onClick={toggleMaximize} style={windowBtnStyle} title="Maximizar">
            <Square size={12} />
          </button>
          <button 
            onClick={() => appWindow?.close()} 
            style={closeBtnStyle} 
            title="Fechar"
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e81123')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
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
