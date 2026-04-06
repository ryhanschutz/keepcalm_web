import React from 'react';
import { useTabStore } from '../store/useTabStore';
import { Globe } from 'lucide-react';

const BookmarksBar: React.FC = () => {
  const { bookmarks, navigate } = useTabStore();

  if (bookmarks.length === 0) return null;

  return (
    <div style={{
      height: '32px',
      background: 'var(--kc-bg-toolbar)',
      borderBottom: '1px solid var(--kc-border-subtle)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: '8px',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      WebkitOverflowScrolling: 'touch',
      zIndex: 999
    }}>
      {bookmarks.map((bookmark) => (
        <button
          key={bookmark.id}
          onClick={() => navigate(bookmark.url)}
          title={bookmark.url}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            borderRadius: 'var(--kc-radius-sm)',
            cursor: 'pointer',
            transition: 'background 0.2s',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
        >
          <Globe size={12} color="var(--kc-text-secondary)" />
          <span style={{ 
            fontSize: '11px', 
            color: 'var(--kc-text-primary)',
            maxWidth: '150px',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {bookmark.title}
          </span>
        </button>
      ))}
    </div>
  );
};

export default BookmarksBar;
