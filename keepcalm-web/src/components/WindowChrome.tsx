import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X, Shield } from 'lucide-react';
import { isTauriRuntime } from '../utils/runtime';

const WindowChrome = () => {
  const isTauri = isTauriRuntime();
  const appWindow = isTauri ? getCurrentWindow() : null;

  return (
    <div
      data-tauri-drag-region={isTauri ? 'true' : undefined}
      style={{
        height: '30px',
        background: 'linear-gradient(to right, #2A4D70, #1A3A5C)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        color: 'white',
        flexShrink: 0
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', pointerEvents: 'none', gap: '8px' }}>
        <Shield size={16} />
        <span style={{ fontSize: '12px', fontFamily: 'var(--kc-font-ui)' }}>KeepCalm Web</span>
      </div>

      <div style={{ flex: 1, textAlign: 'center', fontSize: '13px', pointerEvents: 'none' }}>
        {!isTauri ? 'Preview no navegador' : ''}
      </div>

      <div style={{ display: 'flex', height: '100%', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={() => {
            if (appWindow) {
              void appWindow.minimize();
            }
          }}
          disabled={!appWindow}
          style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex' }}
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => {
            if (appWindow) {
              void appWindow.maximize();
            }
          }}
          disabled={!appWindow}
          style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex' }}
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => {
            if (appWindow) {
              void appWindow.close();
            }
          }}
          disabled={!appWindow}
          style={{ background: 'transparent', border: 'none', color: 'white', display: 'flex' }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default WindowChrome;
