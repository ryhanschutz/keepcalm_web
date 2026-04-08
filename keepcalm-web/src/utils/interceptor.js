(function() {
  if (window.__KEEP_CALM_INTERCEPTOR__) return;
  window.__KEEP_CALM_INTERCEPTOR__ = true;

  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  async function safeInvoke(cmd, args) {
    try {
      if (window.__TAURI__ && window.__TAURI__.invoke) {
        return await window.__TAURI__.invoke(cmd, args);
      } else if (window.ipc && window.ipc.postMessage) {
        // Fallback para IPC direto em contextos remotos
        return await window.ipc.postMessage({ cmd, ...args });
      }
    } catch (e) {
      // Ignorar erros silenciosamente para não quebrar o site
    }
    return null;
  }

  // --- FETCH INTERCEPTOR ---
  window.fetch = async (...args) => {
    const [resource, config] = args;
    const url = typeof resource === 'string' ? resource : resource.url;
    const method = (config?.method || 'GET').toUpperCase();

    // Estágio 1: Capturar Request
    let requestId = await safeInvoke("capture_request", {
      request: {
        method,
        url,
        headers: Object.entries(config?.headers || {}),
        body: config?.body ? { type: "Text", data: String(config.body) } : { type: "Empty" }
      }
    });

    // Executar request original
    const response = await originalFetch(...args);

    // Estágio 2: Capturar Response
    if (requestId) {
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        
        await safeInvoke("capture_response", {
          id: requestId,
          response: {
            status: response.status,
            headers: Array.from(response.headers.entries()),
            body: text ? { type: "Text", data: text } : { type: "Empty" }
          }
        });
      } catch (e) {}
    }

    return response;
  };

  // --- XHR INTERCEPTOR ---
  XMLHttpRequest.prototype.open = function(method, url) {
    this._method = method;
    this._url = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const self = this;
    let requestId;

    // Registrar Request
    safeInvoke("capture_request", {
      request: {
        method: self._method,
        url: self._url,
        headers: [],
        body: body ? { type: "Text", data: String(body) } : { type: "Empty" }
      }
    }).then(id => {
      requestId = id;
    });

    this.addEventListener("load", function() {
      if (requestId) {
        safeInvoke("capture_response", {
          id: requestId,
          response: {
            status: self.status,
            headers: self.getAllResponseHeaders().split('\r\n').filter(h => h).map(h => {
                const parts = h.split(': ');
                return [parts[0], parts.slice(1).join(': ')];
            }),
            body: self.responseText ? { type: "Text", data: self.responseText } : { type: "Empty" }
          }
        });
      }
    });

    return originalSend.apply(this, arguments);
  };
})();
