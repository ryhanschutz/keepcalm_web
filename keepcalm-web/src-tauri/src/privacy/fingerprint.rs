pub fn generate_override_script(_session_uuid: &str) -> String {
    // Definimos valores extremamente comuns (Chrome 122+ em Windows)
    // para evitar que o navegador tenha um "fingerprint estranho".
    r#"
    (function() {
        // 1. Hardware & Performance (Valores altamente comuns)
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        
        // 2. Screen & Viewport (Normalização de Resolução Desktop)
        Object.defineProperty(screen, 'width', { get: () => 1920 });
        Object.defineProperty(screen, 'height', { get: () => 1080 });
        Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
        Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
        Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
        
        // 3. WebRTC Protection (Prevenir vazamento de IP real)
        if (window.RTCPeerConnection) {
            const originalRTC = window.RTCPeerConnection;
            window.RTCPeerConnection = function(config) {
                if (config && config.iceServers) {
                    config.iceServers = []; // Remove servidores ICE para evitar vazamento
                }
                return new originalRTC(config);
            };
            window.RTCPeerConnection.prototype = originalRTC.prototype;
        }

        // 4. AudioContext Protection (Evitar Audio Fingerprinting)
        const originalAudioContext = window.AudioContext || window.webkitAudioContext;
        if (originalAudioContext) {
            const proxyAudio = new Proxy(originalAudioContext, {
                construct(target, args) {
                    const ctx = new target(...args);
                    const originalGetChannelData = ctx.getChannelData;
                    if (originalGetChannelData) {
                        ctx.getChannelData = function() {
                            const data = originalGetChannelData.apply(this, arguments);
                            for (let i = 0; i < data.length; i += 100) {
                                data[i] += (Math.random() - 0.5) * 0.0000001; // Adiciona micro-ruído
                            }
                            return data;
                        };
                    }
                    return ctx;
                }
            });
            window.AudioContext = proxyAudio;
            window.webkitAudioContext = proxyAudio;
        }

        // 5. Canvas Noise (Ruído determinístico leve)
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function() {
            // No futuro, adicionar ruído sutil aqui. 
            // Por enquanto, apenas silenciamos o log para não sermos detectados.
            return originalToDataURL.apply(this, arguments);
        };

        // 6. Timezone & Language (Uniformização)
        // Forçamos UTC ou uma timezone comum se necessário.
    })();
    "#.to_string()
}
