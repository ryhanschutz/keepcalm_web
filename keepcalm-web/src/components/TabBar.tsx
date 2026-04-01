import { Plus, X } from 'lucide-react';
import { useState } from 'react';

const TabBar = () => {
  const [active, setActive] = useState(0);
  const tabs = ['Home', 'Configurações', 'Pesquisar'];

  return (
    <div
      style={{
        height: '30px',
        background: '#D4CFC8',
        borderTop: '3px solid #E4DFD8',
        display: 'flex',
        alignItems: 'end',
        padding: '0 8px',
        gap: '2px',
        flexShrink: 0
      }}
    >
      {tabs.map((tab, idx) => {
        const isActive = idx === active;
        return (
          <div
            key={idx}
            onClick={() => setActive(idx)}
            style={{
              height: isActive ? '28px' : '26px',
              maxWidth: '220px',
              minWidth: '120px',
              background: isActive ? 'var(--kc-bg-active)' : '#C8C3BB',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              borderTop: `1px solid var(--kc-border-main)`,
              borderLeft: `1px solid var(--kc-border-main)`,
              borderRight: `1px solid var(--kc-border-main)`,
              borderBottom: isActive ? 'none' : `1px solid var(--kc-border-main)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 8px',
              cursor: 'pointer',
              fontWeight: isActive ? 'bold' : 'normal',
              zIndex: isActive ? 2 : 1
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab}</span>
            <button 
              style={{ background: 'transparent', border: 'none', display: 'flex' }}
              onClick={(e) => e.stopPropagation()}
            >
              <X size={14} color="var(--kc-text-secondary)" />
            </button>
          </div>
        )
      })}
      
      <button style={{ 
        background: 'transparent', border: 'none', marginLeft: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '26px', width: '26px' 
      }}>
        <Plus size={16} />
      </button>
    </div>
  );
};

export default TabBar;
