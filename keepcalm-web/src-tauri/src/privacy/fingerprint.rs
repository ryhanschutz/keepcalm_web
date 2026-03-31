pub fn generate_override_script(session_uuid: &str) -> String {
    format!(
        r#"
        (function() {{
            const sessionSeed = "{session_uuid}";
            
            // 1. Canvas Fingerprinting Protection
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function() {{
                // Adiciona um ruído determinístico per-session aqui
                return originalToDataURL.apply(this, arguments);
            }};

            // 2. Hardware Info Overrides
            Object.defineProperty(navigator, 'hardwareConcurrency', {{ get: () => 4 }});
            Object.defineProperty(navigator, 'deviceMemory', {{ get: () => 8 }});
            
            // 3. Screen Resolution Normalization
            Object.defineProperty(screen, 'width', {{ get: () => 1920 }});
            Object.defineProperty(screen, 'height', {{ get: () => 1080 }});
            
            console.log("KeepCalm Privacy: Fingerprint protection active.");
        }})();
        "#
    )
}
