import React, { useState, useEffect, useRef } from 'react';
import { X, Terminal, Search, Copy, Play, Zap, ShieldAlert, Cpu } from 'lucide-react';
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

export const SecurityLab: React.FC<SecurityLabProps> = ({ isOpen, onClose }) => {
  const [activeSegment, setActiveSegment] = useState<'recon' | 'audit' | 'payloads' | 'repeater'>('recon');
  const [nucleiLogs, setNucleiLogs] = useState<string[]>([]);
  const [reconResults, setReconResults] = useState<{label: string, value: string}[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isReconRunning, setIsReconRunning] = useState(false);
  
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

  useEffect(() => {
    if (!isOpen) return;

    const unlisten = listen<any>('security-tool-output', (event) => {
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
      void unlisten.then(fn => fn());
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
        if (isBody) { body += line + '\n'; continue; }
        if (line.trim() === '') { isBody = true; continue; }
        
        if (line.match(/^[A-Z]+\s+\//)) {
          const parts = line.split(' ');
          method = parts[0];
          continue;
        }

        if (line.startsWith('URL:')) { url = line.replace('URL:', '').trim(); continue; }
        if (line.startsWith('Method:')) { method = line.replace('Method:', '').trim(); continue; }

        const hMatch = line.match(/^([\w-]+):\s*(.*)$/);
        if (hMatch) {
          headers[hMatch[1]] = hMatch[2];
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

  const copyPayload = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  if (!isOpen) return null;

  return (
    <div className="pp-overlay" onClick={onClose}>
      <aside 
        className="pp-panel security-lab-panel" 
        onClick={e => e.stopPropagation()}
        style={{ width: '420px', borderLeft: '1px solid var(--kc-accent-primary)' }}
      >
        <header className="pp-header" style={{ borderBottomColor: 'var(--kc-accent-primary)' }}>
          <div className="pp-title" style={{ color: 'var(--kc-accent-primary)' }}>
            <Terminal size={16} />
            <strong>Security Lab</strong>
          </div>
          <button className="pp-icon-btn" onClick={onClose}><X size={14} /></button>
        </header>

        <nav className="sec-nav">
          <button 
            className={activeSegment === 'recon' ? 'active' : ''} 
            onClick={() => setActiveSegment('recon')}
          >
            <Search size={14} /> Recon
          </button>
          <button 
            className={activeSegment === 'audit' ? 'active' : ''} 
            onClick={() => setActiveSegment('audit')}
          >
            <ShieldAlert size={14} /> Auditoria
          </button>
          <button 
            className={activeSegment === 'payloads' ? 'active' : ''} 
            onClick={() => setActiveSegment('payloads')}
          >
            <Zap size={14} /> Payloads
          </button>
          <button 
            className={activeSegment === 'repeater' ? 'active' : ''} 
            onClick={() => setActiveSegment('repeater')}
          >
            <Copy size={12} /> Repeater
          </button>
        </nav>

        <main className="sec-content">
          {activeSegment === 'recon' && (
            <div className="sec-recon">
              <div className="sec-card">
                <div className="sec-card-header">
                  <Cpu size={14} /> <strong>Stack de Tecnologia (httpx)</strong>
                </div>
                <div className="sec-card-body">
                  {isReconRunning && reconResults.length === 0 ? (
                    <p className="dim">Sondando {domain}...</p>
                  ) : reconResults.length > 0 ? (
                    reconResults.map((res, i) => (
                      <div key={i} className="tech-item">
                        <span>{res.label}:</span> <strong>{res.value}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="dim">Nenhuma tecnologia detectada.</p>
                  )}
                  {isReconRunning && <div className="loader-line" />}
                </div>
              </div>
            </div>
          )}

          {activeSegment === 'audit' && (
            <div className="sec-audit">
              <div className="audit-controls">
                <span>Alvo: <strong>{domain || 'Nenhum alvo ativo'}</strong></span>
                <button 
                  disabled={!domain || isScanning} 
                  onClick={runNuclei}
                  className="sec-btn-run"
                >
                  <Play size={12} fill="currentColor" /> {isScanning ? 'Scanning...' : 'Run Nuclei'}
                </button>
              </div>
              <div className="audit-console" ref={scrollRef}>
                {nucleiLogs.map((log, i) => (
                  <div key={i} className="console-line">{log}</div>
                ))}
              </div>
            </div>
          )}

          {activeSegment === 'payloads' && (
            <div className="sec-payloads">
              <PayloadSection title="Cross-Site Scripting (XSS)" list={[
                "<script>alert(1)</script>",
                "javascript:alert(1)",
                "<img src=x onerror=alert(1)>",
                "\\\"><script>alert(1)</script>"
              ]} onCopy={copyPayload} />
              
              <PayloadSection title="SQL Injection" list={[
                "' OR '1'='1",
                "admin' --",
                "' UNION SELECT NULL,NULL,NULL--",
                "SLEEP(5)"
              ]} onCopy={copyPayload} />
            </div>
          )}

          {activeSegment === 'repeater' && (
            <div className="sec-repeater">
              <p className="dim" style={{fontSize: '10px', marginBottom: '8px'}}>Edite a requisição abaixo no formato chave-valor ou RAW.</p>
              <div className="repeater-layout">
                <div className="repeater-editor">
                  <div className="editor-header">Request Editor</div>
                  <textarea 
                    className="console-line mono" 
                    value={repeaterRaw}
                    onChange={(e) => setRepeaterRaw(e.target.value)}
                    placeholder={`URL: https://${domain || 'example.com'}\nMethod: GET\nConnection: close\n\n[Corpo opcional]`}
                    style={{
                      width: '100%', 
                      height: '150px', 
                      background: '#000', 
                      color: '#fff', 
                      border: '1px solid #333', 
                      padding: '8px', 
                      fontSize: '11px',
                      resize: 'none'
                    }}
                  />
                  <button 
                    className="sec-btn-run" 
                    style={{marginTop: '8px', width: '100%'}}
                    onClick={sendRepeater}
                    disabled={isSending}
                  >
                    {isSending ? 'Sending...' : 'Send Request'}
                  </button>
                </div>
                <div className="repeater-response" style={{marginTop: '12px'}}>
                  <div className="editor-header">Response</div>
                  <div className="audit-console" style={{height: '200px', whiteSpace: 'pre', color: '#00d0ff'}}>
                    {repeaterResponse || 'Esperando requisição...'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </aside>

      <style>{`
        .security-lab-panel {
          background: #0d1117;
          display: flex;
          flex-direction: column;
        }
        .mono { font-family: 'Fira Code', monospace; }
        .editor-header { font-size: 10px; color: var(--kc-accent-primary); margin-bottom: 4px; text-transform: uppercase; }
        .sec-nav {
          display: flex;
          padding: 8px;
          gap: 4px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .sec-nav button {
          flex: 1;
          background: transparent;
          border: 1px solid transparent;
          color: var(--kc-text-secondary);
          padding: 6px 4px;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          border-radius: 4px;
        }
        .sec-nav button.active {
          background: rgba(var(--kc-accent-primary-rgb), 0.1);
          color: var(--kc-accent-primary);
          border-color: rgba(var(--kc-accent-primary-rgb), 0.2);
        }
        .sec-content {
          padding: 12px;
          flex: 1;
          overflow-y: auto;
          font-family: 'Fira Code', 'Consolas', monospace;
        }
        .sec-card {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          margin-bottom: 12px;
        }
        .sec-card-header {
          padding: 8px 12px;
          border-bottom: 1px solid #30363d;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sec-card-body {
          padding: 12px;
          font-size: 11px;
        }
        .tech-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .dim { opacity: 0.5; font-style: italic; }
        
        .audit-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 11px;
        }
        .sec-btn-run {
          background: var(--kc-accent-primary);
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
        }
        .sec-btn-run:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .audit-console {
          background: black;
          border-radius: 4px;
          height: 300px;
          padding: 8px;
          font-size: 10px;
          color: #00ff00;
          overflow-y: auto;
          white-space: pre-wrap;
          border: 1px solid #333;
        }
        .console-line { margin-bottom: 2px; }

        .sec-payload-section { margin-bottom: 16px; }
        .sec-payload-section h4 { 
          font-size: 11px; 
          margin-bottom: 8px; 
          color: var(--kc-accent-primary);
        }
        .payload-row {
          display: flex;
          align-items: center;
          background: #161b22;
          border: 1px solid #30363d;
          padding: 6px 8px;
          border-radius: 4px;
          margin-bottom: 4px;
          gap: 8px;
          font-size: 10px;
        }
        .payload-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .payload-copy {
          background: transparent;
          border: none;
          color: var(--kc-text-secondary);
          cursor: pointer;
          opacity: 0.5;
        }
        .payload-copy:hover { opacity: 1; color: var(--kc-accent-primary); }

        .loader-line {
          height: 2px;
          width: 100%;
          background: linear-gradient(90deg, transparent, var(--kc-accent-primary), transparent);
          background-size: 50% 100%;
          animation: loading 1.5s infinite linear;
          margin-top: 8px;
        }
        @keyframes loading {
          0% { background-position: -150% 0; }
          100% { background-position: 150% 0; }
        }
      `}</style>
    </div>
  );
};

interface PayloadSectionProps {
  title: string;
  list: string[];
  onCopy: (s: string) => void;
}

const PayloadSection: React.FC<PayloadSectionProps> = ({ title, list, onCopy }) => (
  <div className="sec-payload-section">
    <h4>{title}</h4>
    {list.map((p, i) => (
      <div key={i} className="payload-row">
        <span className="payload-text">{p}</span>
        <button className="payload-copy" onClick={() => onCopy(p)}>
          <Copy size={12} />
        </button>
      </div>
    ))}
  </div>
);
