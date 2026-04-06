import { invoke } from '@tauri-apps/api/core';
import { Plus, Shield } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useTabStore } from '../store/useTabStore';
import { isTauriRuntime } from '../utils/runtime';

const ContentArea = () => {
  const { 
    tabs, 
    activeTabId, 
    privacyStats, 
    navigate, 
    updateTab, 
    bookmarks 
  } = useTabStore();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const tauri = isTauriRuntime();

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? null,
    [tabs, activeTabId],
  );

  const blockedCount = privacyStats.blocked_requests;
  const blockedHost = useMemo(
    () => extractHost(privacyStats.last_blocked_url),
    [privacyStats.last_blocked_url],
  );

  useEffect(() => {
    if (!tauri || !contentRef.current) {
      return;
    }

    let frameId = 0;
    const element = contentRef.current;

    const syncBounds = () => {
      const bounds = element.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;

      tabs.forEach((tab) => {
        if (!tab.hasWebview) {
          return;
        }

        const isVisible = tab.id === activeTabId && !tab.isInternal;
        const x = isVisible ? bounds.left * scale : -20000;
        const y = isVisible ? bounds.top * scale : -20000;
        const width = isVisible ? bounds.width * scale : 1;
        const height = isVisible ? bounds.height * scale : 1;

        void invoke('reposition_webview', {
          id: tab.id,
          x,
          y,
          width,
          height,
        }).catch((error) => {
          console.error('Failed to reposition webview:', error);
        });
      });
    };

    const scheduleSync = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(syncBounds);
    };

    scheduleSync();

    const resizeObserver = new ResizeObserver(scheduleSync);
    resizeObserver.observe(element);
    window.addEventListener('resize', scheduleSync);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleSync);
    };
  }, [tabs, activeTabId, tauri]);

  const shouldRenderStartPage = !activeTab || activeTab.isInternal;
  const shouldRenderPreviewFrame = !shouldRenderStartPage && !tauri && !!activeTab;

  return (
    <main ref={contentRef} className={`content-area ${shouldRenderStartPage ? 'content-area-start' : 'content-area-web'}`}>
      {shouldRenderStartPage ? <div className="content-backdrop" /> : null}

      {shouldRenderStartPage ? (
        <div className="start-page">
          <section className="start-group">
            <h2>Your Favourites</h2>
            <div className="favorite-grid">
              {bookmarks.length > 0 ? (
                bookmarks.map((bookmark) => (
                  <button
                    key={bookmark.url}
                    type="button"
                    className="favorite-tile"
                    onClick={() => navigate(bookmark.url)}
                  >
                    <span className="favorite-badge tone-silver">
                      {(bookmark.title || bookmark.url).charAt(0).toUpperCase()}
                    </span>
                    <span className="favorite-name">{bookmark.title || bookmark.url}</span>
                  </button>
                ))
              ) : (
                <div style={{ color: 'var(--kc-text-secondary)', fontSize: '13px', opacity: 0.6, padding: '20px 0' }}>
                  Seus favoritos aparecerão aqui.
                </div>
              )}
              {/* Botão sempre presente para facilitar a navegação inicial se estiver vazio */}
              {bookmarks.length === 0 && (
                 <button
                  type="button"
                  className="favorite-tile"
                  onClick={() => navigate('https://google.com')}
                >
                  <span className="favorite-badge tone-graphite">
                    <Plus size={28} />
                  </span>
                  <span className="favorite-name">Começar</span>
                </button>
              )}
            </div>
          </section>

          <section className="start-group">
            <h2>Privacy Report</h2>
            <div className="privacy-report">
              <div className="privacy-count">
                <Shield size={15} />
                <strong>{blockedCount}</strong>
              </div>
              <p>
                {blockedCount === 0
                  ? 'In this session, KeepCalm has not encountered trackers profiling you.'
                  : blockedHost
                    ? `In this session, KeepCalm blocked ${blockedCount} tracker requests. Last blocked origin: ${blockedHost}.`
                    : `In this session, KeepCalm blocked ${blockedCount} tracker requests.`}
              </p>
            </div>
          </section>
        </div>
      ) : null}

      {shouldRenderPreviewFrame && activeTab ? (
        <iframe
          key={activeTab.id}
          title={activeTab.title}
          src={activeTab.url}
          className="browser-preview-frame"
          onLoad={() => updateTab(activeTab.id, { isLoading: false })}
        />
      ) : null}

      {!shouldRenderStartPage && tauri && activeTab?.isLoading ? (
        <div className="webview-loading-indicator">Loading...</div>
      ) : null}
    </main>
  );
};

export default ContentArea;

function extractHost(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}
