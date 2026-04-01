import { ArrowLeft, ArrowRight, RotateCw, Home, Shield, Puzzle, Menu } from 'lucide-react';
import { useState } from 'react';

const Toolbar = () => {
  const [url, setUrl] = useState('https://keepcalm.app/');
  const [focused, setFocused] = useState(false);

  return (
    <div
      style={{
        height: '34px',
        background: 'var(--kc-bg-toolbar)',
        borderBottom: '1px solid var(--kc-border-main)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '4px',
        flexShrink: 0
      }}
    >
      <button style={{ width: '28px', height: '28px', background: 'transparent', border: '1px solid transparent', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ArrowLeft size={16} />
      </button>
      <button style={{ width: '28px', height: '28px', background: 'transparent', border: '1px solid transparent', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ArrowRight size={16} />
      </button>
      <button style={{ width: '28px', height: '28px', background: 'transparent', border: '1px solid transparent', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RotateCw size={16} />
      </button>
      <button style={{ width: '28px', height: '28px', background: 'transparent', border: '1px solid transparent', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Home size={16} />
      </button>

      <div style={{ width: '1px', height: '20px', backgroundColor: '#BBBBAA', margin: '0 4px' }} />

      {/* Address Bar */}
      <div 
        style={{
          flex: 1,
          height: '26px',
          background: focused ? '#FFFFFF' : 'var(--kc-bg-active)',
          border: focused ? '2px solid var(--kc-accent-hover)' : '1px solid #BBBBAA',
          borderRadius: '3px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          fontFamily: 'var(--kc-font-mono)'
        }}
      >
        <span style={{ color: 'var(--kc-success)', marginRight: '8px', display: 'flex' }}><Shield size={14} /></span>
        <input 
          type="text" 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: '13px',
            color: 'var(--kc-text-primary)'
          }}
        />
      </div>

      <div style={{ width: '1px', height: '20px', backgroundColor: '#BBBBAA', margin: '0 4px' }} />

      <button style={{ width: '28px', height: '28px', background: 'transparent', border: '1px solid transparent', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Shield size={16} color="var(--kc-accent-primary)" />
      </button>
      <button style={{ width: '28px', height: '28px', background: 'transparent', border: '1px solid transparent', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Puzzle size={16} />
      </button>
      <button style={{ width: '28px', height: '28px', background: 'transparent', border: '1px solid transparent', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Menu size={16} />
      </button>
    </div>
  );
};

export default Toolbar;
