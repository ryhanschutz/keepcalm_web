import React, { useState, useEffect, useRef } from 'react';
import { X, Terminal, Play, Activity, Database, Shield, Send, Search, Trash2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTabStore } from '../store/useTabStore';

interface SecurityLabProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ToolOutput {
  tool: string;
  type: 'stdout' | 'stderr' | 'terminated';
  content?: string;
  code?: number;
}

interface HttpTransaction {
  id: String;
  hash: string;
  request: {
    method: string;
    url: string;
    headers: [string, string][];
    body: { type: string, data?: string };
  };
  response?: {
    status: number;
    headers: [string, string][];
    body: { type: string, data?: string };
  };
  timestamp: number;
  tags: string[];
}

export const SecurityLab: React.FC<SecurityLabProps> = ({ isOpen, onClose }) => {
  const [activeSegment, setActiveSegment] = useState<'traffic' | 'recon' | 'audit' | 'repeater'>('traffic');
  const [nucleiLogs, setNucleiLogs] = useState<string[]>([]);
  const [reconResults, setReconResults] = useState<{label: string, value: string}[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isReconRunning, setIsReconRunning] = useState(false);
  
  const [transactions, setTransactions] = useState<HttpTransaction[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [repeaterRaw, setRepeaterRaw] = useState<string>('');
  const [repeaterResponse, setRepeaterResponse] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabId = useTabStore(state => state.activeTabId);
  const tabs = useTabStore(state => state.tabs);
  const activeTab = tabs.find(t => t.id === activeTabId);

  const domain = React.useMemo(() => {
    if (!activeTab || activeTab.isInternal) return '';
    try { return new URL(activeTab.url).hostname; } catch { return ''; }
  }, [activeTab]);

  const refreshTraffic = async () => {
    try {
      const list = await invoke<HttpTransaction[]>('get_traffic_list');
      setTransactions([...list].reverse()); // Newest first
    } catch (e) {
      console.error('Failed to get traffic:', e);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshTraffic();

    const unlistenTraffic = listen('traffic-updated', () => {
      refreshTraffic();
    });

    const unlistenOutput = listen<any>('security-tool-output', (event) => {
      const payload: ToolOutput = event.payload;
      if (payload.tool === 'nuclei') {
        if (payload.type === 'stdout' || payload.type === 'stderr') {
          setNucleiLogs(prev => [...prev.slice(-100), payload.content || '']);
        } else if (payload.type === 'terminated') {
          setIsScanning(false);
          setNucleiLogs(prev => [...prev, `\n[FINISH] Auditoria encerrada.`]);
        }
      } else if (payload.tool === 'httpx') {
        if (payload.type === 'stdout') {
          const line = payload.content || '';
          const techMatch = line.match(/\[(.*?)\]/g);
          if (techMatch && techMatch.length > 0) {
            const techs = techMatch[techMatch.length - 1].replace(/[\[\]]/g, '').split(',');
            setReconResults(prev => {
              const newTechs = techs.map(t => ({ label: 'Tecnologia', value: t.trim() }));
              const unique = [...prev];
              newTechs.forEach(nt => {
                if (!unique.find(u => u.value === nt.value)) unique.push(nt);
              });
              return unique;
            });
          }
        } else if (payload.type === 'terminated') {
          setIsReconRunning(false);
        }
      }
    });

    return () => {
      void unlistenTraffic.then(fn => fn());
      void unlistenOutput.then(fn => fn());
    };
  }, [isOpen]);

  const runHttpxRecon = async () => {
    if (!domain) return;
    setIsReconRunning(true);
    setReconResults([]);
    try {
      await invoke('run_security_tool', {
        toolName: 'httpx',
        args: ['-u', domain, '-td', '-silent', '-nc']
      });
    } catch (e) {
      console.error('Recon failed:', e);
      setIsReconRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeSegment === 'recon' && domain && reconResults.length === 0 && !isReconRunning) {
      void runHttpxRecon();
    }
  }, [isOpen, activeSegment, domain, reconResults.length, isReconRunning]);

  const runNuclei = async () => {
    if (!domain) return;
    setIsScanning(true);
    setNucleiLogs([`[INFO] Iniciando Nuclei Audit em: ${domain}...`]);
    try {
      await invoke('run_security_tool', {
        toolName: 'nuclei',
        args: ['-u', domain, '-silent', '-nc']
      });
    } catch (e) {
      setNucleiLogs(prev => [...prev, `[ERRO] ${e}`]);
      setIsScanning(false);
    }
  };

  const clearTraffic = async () => {
    await invoke('clear_traffic');
    setTransactions([]);
  };

  const sendToRepeater = (tx: HttpTransaction) => {
    const raw = `URL: ${tx.request.url}\nMethod: ${tx.request.method}\n` +
      tx.request.headers.map(([h, v]) => `${h}: ${v}`).join('\n') +
      '\n\n' + (tx.request.body.type === 'Text' ? tx.request.body.data : '');
    
    setRepeaterRaw(raw);
    setActiveSegment('repeater');
    setRepeaterResponse(null);
  };

  const sendRepeater = async () => {
    if (!repeaterRaw) return;
    setIsSending(true);
    setRepeaterResponse('Enviando...');
    
    try {
      const lines = repeaterRaw.split('\n');
      let method = 'GET';
      let url = domain ? `https://${domain}` : '';
      const headers: Record<string, string> = {};
      let body = '';
      let isBody = false;

      for (let line of lines) {
        if (isBody) { body += (body ? '\n' : '') + line; continue; }
        if (line.trim() === '') { isBody = true; continue; }
        
        if (line.startsWith('URL:')) { url = line.replace('URL:', '').trim(); continue; }
        if (line.startsWith('Method:')) { method = line.replace('Method:', '').trim(); continue; }

        const hMatch = line.match(/^([\w-]+):\s*(.*)$/);
        if (hMatch) {
          headers[hMatch[1].toLowerCase()] = hMatch[2];
        }
      }

      const response = await invoke<any>('send_repeater_request', {
        req: { method, url, headers, body: body.trim() || null }
      });
      
      setRepeaterResponse(`HTTP/1.1 ${response.status}\n` + 
        Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\n') + 
        '\n\n' + response.body
      );
    } catch (e) {
      setRepeaterResponse(`[ERRO] ${e}`);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [nucleiLogs]);

  const selectedTx = transactions.find(t => t.id === selectedTxId);
  const filteredTxs = transactions.filter(t => 
    t.request.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.request.method.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside 
      className="security-lab-sidebar"
      style={{
        width: isOpen ? '400px' : '0px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: isOpen ? '1px solid var(--kc-border-main)' : '0px solid transparent',
        background: 'rgba(25, 25, 25, 0.82)',
        backdropFilter: 'blur(24px) saturate(140%)',
        zIndex: 5,
        boxShadow: isOpen ? '-8px 0 32px rgba(0,0,0,0.5)' : 'none',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        opacity: isOpen ? 1 : 0
      }}
    >
      <header className="sec-header" style={{ 
        padding: '14px 16px', 
        borderBottom: '1px solid var(--kc-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: '400px'
      }}>
        <div className="sec-title" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          color: 'var(--kc-text-primary)',
          fontSize: 'var(--kc-font-size-title)',
          fontWeight: 600,
          opacity: 0.9
        }}>
          <Terminal size={14} strokeWidth={2.5} />
          <span style={{ letterSpacing: '-0.01em' }}>Security Lab</span>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--kc-border-subtle)',
            color: 'var(--kc-text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex'
          }}
        >
          <X size={14} />
        </button>
      </header>

      <nav className="sec-tabs" style={{
        display: 'flex',
        padding: '12px 16px 8px',
        gap: '2px',
        minWidth: '400px'
      }}>
        {(['traffic', 'recon', 'audit', 'repeater'] as const).map(tab => (
          <button 
            key={tab}
            className={activeSegment === tab ? 'active' : ''} 
            onClick={() => {
              setActiveSegment(tab);
              if (tab !== 'traffic') setSelectedTxId(null);
            }}
            style={{
              flex: 1,
              padding: '6px 4px',
              fontSize: '11px',
              fontWeight: 500,
              borderRadius: '6px',
              border: 'none',
              background: activeSegment === tab ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: activeSegment === tab ? 'var(--kc-text-primary)' : 'var(--kc-text-secondary)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            {tab === 'traffic' && <Activity size={10} />}
            {tab === 'recon' && <Database size={10} />}
            {tab === 'audit' && <Shield size={10} />}
            {tab === 'repeater' && <Send size={10} />}
            <span>{tab === 'traffic' ? 'Traffic' : tab === 'recon' ? 'Recon' : tab === 'audit' ? 'Audit' : 'Repeater'}</span>
          </button>
        ))}
      </nav>

      <main className="sec-scrollarea" style={{ flex: 1, overflowY: 'auto', padding: '16px', minWidth: '400px', display: 'flex', flexDirection: 'column' }}>
        
        {activeSegment === 'traffic' && (
          <div className="sec-view traffic-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--kc-text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Filtrar requests..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--kc-border-subtle)',
                    borderRadius: '8px',
                    padding: '8px 8px 8px 32px',
                    fontSize: '11px',
                    color: 'var(--kc-text-primary)',
                    outline: 'none'
                  }}
                />
              </div>
              <button 
                onClick={clearTraffic}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--kc-border-subtle)',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  color: 'var(--kc-text-secondary)',
                  cursor: 'pointer'
                }}
                title="Limpar Tudo"
              >
                <Trash2 size={12} />
              </button>
            </div>

            <div style={{ 
              flex: 1, 
              background: '#0a0a0a', 
              borderRadius: '10px', 
              border: '1px solid var(--kc-border-main)',
              overflowY: 'auto',
              maxHeight: selectedTx ? '200px' : '480px',
              transition: 'max-height 0.3s'
            }}>
              {filteredTxs.map((tx) => (
                <div 
                  key={tx.id as string} 
                  onClick={() => setSelectedTxId(tx.id === selectedTxId ? null : (tx.id as string))}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    background: selectedTxId === tx.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <div style={{
                    minWidth: '34px',
                    fontSize: '9px',
                    fontWeight: 800,
                    color: tx.request.method === 'POST' ? 'var(--kc-accent-primary)' : 'var(--kc-text-muted)',
                    textAlign: 'center'
                  }}>{tx.request.method}</div>
                  
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ 
                      fontSize: '11px', 
                      color: 'var(--kc-text-primary)', 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis' 
                    }}>
                      {tx.request.url.replace(/^https?:\/\//, '')}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                      {tx.tags.map(tag => (
                        <span key={tag} style={{
                          fontSize: '8px',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          background: tag === 'auth' ? 'rgba(255, 171, 0, 0.1)' : tag === 'error' ? 'rgba(255, 82, 82, 0.1)' : 'rgba(255,255,255,0.05)',
                          color: tag === 'auth' ? '#ffab00' : tag === 'error' ? '#ff5252' : 'var(--kc-text-muted)',
                          border: `1px solid ${tag === 'auth' ? 'rgba(255, 171, 0, 0.2)' : 'rgba(255,255,255,0.1)'}`
                        }}>{tag}</span>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: !tx.response ? 'var(--kc-text-disabled)' : tx.response.status < 300 ? '#4caf50' : tx.response.status < 400 ? '#ff9800' : '#f44336'
                  }}>
                    {tx.response?.status || '...'}
                  </div>
                </div>
              ))}
              {filteredTxs.length === 0 && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--kc-text-muted)', fontSize: '11px' }}>
                  {searchQuery ? 'Sem resultados para o filtro.' : 'Capturando tráfego em tempo real...'}
                </div>
              )}
            </div>

            {selectedTx && (
              <div style={{ 
                flex: 1, 
                background: 'rgba(0,0,0,0.2)', 
                border: '1px solid var(--kc-border-subtle)', 
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minHeight: '260px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '10px', fontWeight: 800, color: 'var(--kc-accent-primary)' }}>MENSAGEM SELECIONADA</h4>
                  <button 
                    onClick={() => sendToRepeater(selectedTx)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--kc-border-subtle)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      color: 'var(--kc-text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Send size={10} /> Enviar ao Repeater
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'var(--kc-font-mono)', fontSize: '10px' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ color: 'var(--kc-text-muted)', marginBottom: '4px' }}>HEADERS</div>
                    {selectedTx.request.headers.map(([k, v]) => (
                      <div key={k} style={{ marginBottom: '2px' }}>
                        <span style={{ color: '#888' }}>{k}:</span> <span style={{ color: '#ccc' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  {selectedTx.request.body.type === 'Text' && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ color: 'var(--kc-text-muted)', marginBottom: '4px' }}>BODY</div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', color: '#cad3f5' }}>
                        {selectedTx.request.body.data}
                      </div>
                    </div>
                  )}

                  {selectedTx.response && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                      <div style={{ color: 'var(--kc-text-muted)', marginBottom: '4px' }}>RESPONSE ({selectedTx.response.status})</div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', color: '#a5d6ff', fontSize: '9px', maxHeight: '100px', overflowY: 'auto' }}>
                        {selectedTx.response.body.type === 'Text' ? selectedTx.response.body.data : '[Binary/Base64]'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ fontSize: '9px', color: 'var(--kc-text-muted)', textAlign: 'right', opacity: 0.6 }}>
              {transactions.length} / 800 requisições capturadas (FIFO)
            </div>
          </div>
        )}

        {activeSegment === 'recon' && (
          <div className="sec-view">
            <h4 style={{ color: 'var(--kc-text-muted)', fontSize: '10px', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.08em', fontWeight: 700 }}>
              Stack de Tecnologia
            </h4>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '16px', border: '1px solid var(--kc-border-subtle)' }}>
              {isReconRunning && reconResults.length === 0 ? (
                <div style={{ color: 'var(--kc-text-secondary)', fontSize: '12px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="loader-pulse" /> Analisando {domain}...
                </div>
              ) : reconResults.length > 0 ? (
                reconResults.map((res, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                    <span style={{ color: 'var(--kc-text-secondary)' }}>{res.label}</span>
                    <strong style={{ color: 'var(--kc-text-primary)', fontWeight: 600 }}>{res.value}</strong>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--kc-text-secondary)', fontSize: '12px', opacity: 0.6 }}>Aguardando navegação para iniciar reconhecimento.</div>
              )}
            </div>
          </div>
        )}

        {activeSegment === 'audit' && (
          <div className="sec-view">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', color: 'var(--kc-text-secondary)' }}>Alvo: <strong style={{color: 'var(--kc-text-primary)'}}>{domain || 'Nenhum'}</strong></span>
              <button 
                disabled={!domain || isScanning}
                onClick={runNuclei}
                style={{
                  background: isScanning ? 'rgba(255,255,255,0.05)' : 'var(--kc-text-primary)',
                  color: isScanning ? 'var(--kc-text-secondary)' : 'var(--kc-bg-base)',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'opacity 0.2s'
                }}
              >
                <Play size={10} fill="currentColor" /> {isScanning ? 'Em execução' : 'Iniciar Scan'}
              </button>
            </div>
            <div ref={scrollRef} style={{ 
              background: '#0a0a0a', 
              borderRadius: '10px', 
              padding: '12px', 
              height: '400px', 
              overflowY: 'auto', 
              fontFamily: 'var(--kc-font-mono)', 
              fontSize: '11px',
              border: '1px solid var(--kc-border-main)',
              lineHeight: '1.5'
            }}>
              {nucleiLogs.map((log, i) => (
                <div key={i} style={{ 
                  color: log.includes('[ERRO]') ? 'var(--kc-danger)' : log.includes('[INFO]') ? 'var(--kc-text-secondary)' : '#a5d6ff',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  paddingBottom: '2px',
                  marginBottom: '4px'
                }}>{log}</div>
              ))}
              {nucleiLogs.length === 0 && <div style={{color: 'var(--kc-text-disabled)', textAlign: 'center', paddingTop: '40px'}}>Nenhum log de auditoria ainda.</div>}
            </div>
          </div>
        )}

        {activeSegment === 'repeater' && (
          <div className="sec-view">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--kc-text-muted)', display: 'block', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.05em' }}>REQUEST EDITOR</label>
                <textarea 
                  value={repeaterRaw}
                  onChange={(e) => setRepeaterRaw(e.target.value)}
                  placeholder={`URL: https://${domain || 'exemplo.com'}\nMethod: GET\n\n[Corpo opcional]`}
                  style={{
                    width: '100%',
                    height: '160px',
                    background: '#0a0a0a',
                    color: '#fff',
                    border: '1px solid var(--kc-border-main)',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '12px',
                    fontFamily: 'var(--kc-font-mono)',
                    resize: 'none',
                    outline: 'none'
                  }}
                />
                <button 
                  onClick={sendRepeater}
                  disabled={isSending}
                  style={{
                    width: '100%',
                    marginTop: '10px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--kc-text-primary)',
                    border: '1px solid var(--kc-border-subtle)',
                    padding: '8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                >
                  {isSending ? 'Enviando...' : 'Repetir Requisição'}
                </button>
              </div>

              <div>
                <label style={{ fontSize: '10px', color: 'var(--kc-text-muted)', display: 'block', marginBottom: '6px', fontWeight: 700, letterSpacing: '0.05em' }}>RESPONSE</label>
                <div style={{ 
                  background: '#0a0a0a', 
                  borderRadius: '8px', 
                  padding: '12px', 
                  height: '240px', 
                  overflowY: 'auto', 
                  fontFamily: 'var(--kc-font-mono)', 
                  fontSize: '11px',
                  color: '#cad3f5',
                  border: '1px solid var(--kc-border-main)',
                  whiteSpace: 'pre-wrap'
                }}>
                  {repeaterResponse || 'Aguardando envio...'}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .loader-pulse {
          width: 8px;
          height: 8px;
          background: var(--kc-success);
          border-radius: 50%;
          animation: pulse 1s infinite alternate;
        }
        @keyframes pulse {
          from { opacity: 0.3; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </aside>
  );
};
