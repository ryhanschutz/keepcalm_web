import React, { useState } from 'react';
import { Download, X, CheckCircle, Clock, FolderOpen } from 'lucide-react';
import { useDownloadStore } from '../store/useDownloadStore';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

const DownloadIndicator: React.FC = () => {
  const { downloads, clearFinished } = useDownloadStore();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenFolder = async (path?: string) => {
    if (path) {
      try {
        await revealItemInDir(path);
      } catch (err) {
        console.error('Failed to open folder:', err);
      }
    }
  };

  const activeDownloads = downloads.filter(d => d.status === 'downloading' || d.status === 'starting');
  const hasFinished = downloads.some(d => d.status === 'finished');

  if (downloads.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: activeDownloads.length > 0 ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
          border: 'none',
          padding: '8px',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: activeDownloads.length > 0 ? '#3b82f6' : '#94a3b8',
          transition: 'all 0.2s',
        }}
      >
        <Download size={20} strokeWidth={activeDownloads.length > 0 ? 2.5 : 2} />
        {activeDownloads.length > 0 && (
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{activeDownloads.length}</span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '300px',
          maxHeight: '400px',
          background: 'rgba(23, 23, 23, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          zIndex: 1000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            padding: '12px 16px', 
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#f8fafc' }}>Downloads</span>
            {hasFinished && (
              <button 
                onClick={clearFinished}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer' }}
              >
                Limpar concluídos
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', padding: '8px' }}>
            {downloads.map((download) => (
              <div key={download.id} style={{ 
                padding: '10px', 
                borderRadius: '8px', 
                marginBottom: '4px',
                background: 'rgba(255,255,255,0.02)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ 
                    fontSize: '13px', 
                    color: '#e2e8f0', 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    maxWidth: '180px'
                  }}>
                    {download.filename}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {download.status === 'finished' && (
                      <button 
                        onClick={() => handleOpenFolder(download.path)}
                        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: '2px', display: 'flex' }}
                        title="Abrir na pasta"
                      >
                        <FolderOpen size={14} />
                      </button>
                    )}
                    {download.status === 'finished' && <CheckCircle size={14} color="#10b981" />}
                    {download.status === 'canceled' && <X size={14} color="#ef4444" />}
                    {download.status === 'downloading' && <Clock size={14} color="#3b82f6" />}
                  </div>
                </div>

                {download.status === 'downloading' && (
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                    <div style={{ 
                      width: `${download.progress}%`, 
                      height: '100%', 
                      background: '#3b82f6', 
                      borderRadius: '2px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                  <span>{download.status === 'finished' ? 'Concluído' : `${download.progress}%`}</span>
                  <span>{download.downloadedSize > 0 ? `${(download.downloadedSize / (1024 * 1024)).toFixed(1)} MB` : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadIndicator;
