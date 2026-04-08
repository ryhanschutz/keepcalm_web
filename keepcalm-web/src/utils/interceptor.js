(function () {
  if (window.__KEEP_CALM_INTERCEPTOR__) return;
  window.__KEEP_CALM_INTERCEPTOR__ = true;

  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  function getInvoke() {
    if (window.__TAURI__?.invoke) return window.__TAURI__.invoke;
    if (window.__TAURI__?.core?.invoke) return window.__TAURI__.core.invoke;
    return null;
  }

  async function safeInvoke(cmd, args) {
    const invoke = getInvoke();
    if (!invoke) return null;

    try {
      return await invoke(cmd, args);
    } catch (_) {
      return null;
    }
  }

  function createRequestId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `kc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeHeaders(input) {
    if (!input) return [];
    if (input instanceof Headers) return Array.from(input.entries());
    if (Array.isArray(input)) return input.map(([key, value]) => [String(key), String(value)]);
    return Object.entries(input).map(([key, value]) => [String(key), String(value)]);
  }

  function bodyToPayload(body) {
    if (body == null) return { type: "Empty" };
    if (typeof body === "string") return { type: "Text", data: body };
    if (body instanceof URLSearchParams) return { type: "Text", data: body.toString() };
    if (body instanceof FormData) {
      const pairs = [];
      body.forEach((value, key) => {
        pairs.push(`${key}=${value instanceof File ? `[File ${value.name}]` : String(value)}`);
      });
      return { type: "Text", data: pairs.join("&") };
    }
    if (body instanceof Blob) {
      return { type: "Text", data: `[Blob ${body.type || "application/octet-stream"} ${body.size} bytes]` };
    }
    if (body instanceof ArrayBuffer) {
      return { type: "Text", data: `[ArrayBuffer ${body.byteLength} bytes]` };
    }
    if (ArrayBuffer.isView(body)) {
      return { type: "Text", data: `[TypedArray ${body.byteLength} bytes]` };
    }
    return { type: "Text", data: String(body) };
  }

  function captureResponse(id, response) {
    return safeInvoke("capture_response", {
      id,
      response,
    });
  }

  window.fetch = async (...args) => {
    const [resource, config] = args;
    const request = resource instanceof Request ? resource : null;
    const requestId = createRequestId();
    const method = (config?.method || request?.method || "GET").toUpperCase();
    const url = request ? request.url : String(resource);
    const headers = normalizeHeaders(config?.headers || request?.headers);
    const body = config?.body ?? null;

    void safeInvoke("capture_request", {
      id: requestId,
      request: {
        method,
        url,
        headers,
        body: bodyToPayload(body),
      },
      tags: ["fetch", "scripted"],
    });

    const response = await originalFetch(...args);
    const cloned = response.clone();

    cloned
      .text()
      .then((text) =>
        captureResponse(requestId, {
          status: response.status,
          headers: Array.from(response.headers.entries()),
          body: text ? { type: "Text", data: text } : { type: "Empty" },
        }),
      )
      .catch(() =>
        captureResponse(requestId, {
          status: response.status,
          headers: Array.from(response.headers.entries()),
          body: { type: "Empty" },
        }),
      );

    return response;
  };

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__keepCalmMethod = method;
    this.__keepCalmUrl = url;
    this.__keepCalmHeaders = [];
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (key, value) {
    this.__keepCalmHeaders = this.__keepCalmHeaders || [];
    this.__keepCalmHeaders.push([String(key), String(value)]);
    return originalSetRequestHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const self = this;
    const requestId = createRequestId();

    void safeInvoke("capture_request", {
      id: requestId,
      request: {
        method: String(self.__keepCalmMethod || "GET").toUpperCase(),
        url: String(self.__keepCalmUrl || ""),
        headers: self.__keepCalmHeaders || [],
        body: bodyToPayload(body),
      },
      tags: ["scripted", "xhr"],
    });

    this.addEventListener(
      "loadend",
      function () {
        const headers = self
          .getAllResponseHeaders()
          .split("\r\n")
          .filter(Boolean)
          .map((header) => {
            const parts = header.split(": ");
            return [parts[0], parts.slice(1).join(": ")];
          });

        let bodyPayload = { type: "Empty" };
        try {
          if (typeof self.responseText === "string" && self.responseText.length > 0) {
            bodyPayload = { type: "Text", data: self.responseText };
          } else if (self.responseType === "blob" && self.response) {
            bodyPayload = {
              type: "Text",
              data: `[Blob ${self.response.type || "application/octet-stream"} ${self.response.size} bytes]`,
            };
          } else if (self.responseType === "arraybuffer" && self.response) {
            bodyPayload = {
              type: "Text",
              data: `[ArrayBuffer ${self.response.byteLength} bytes]`,
            };
          }
        } catch (_) {}

        void captureResponse(requestId, {
          status: self.status,
          headers,
          body: bodyPayload,
        });
      },
      { once: true },
    );

    return originalSend.apply(this, arguments);
  };
})();
