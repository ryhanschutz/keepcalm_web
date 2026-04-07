pub fn get_youtube_adblock_script() -> &'static str {
    r#"
    (function() {
        console.log("[KeepCalm] Iniciando bloqueador cosmético do YouTube...");
        
        // CSS para ocultar anúncios comuns do painel e do overlay
        const style = document.createElement('style');
        style.innerHTML = `
            ytd-ad-slot-renderer,
            ytd-rich-item-renderer:has(.ytd-ad-slot-renderer),
            ytd-promoted-sparkles-web-renderer,
            .ytp-ad-overlay-container,
            .ytp-ad-message-container {
                display: none !important;
            }
        `;
        document.head.appendChild(style);

        // MutObserver para pular ou acelerar anúncios em vídeo
        const observer = new MutationObserver(() => {
            const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
            if (skipButton) {
                skipButton.click();
            }

            const adVideo = document.querySelector('.video-ads .html5-main-video, .ytp-ad-player-overlay');
            if (adVideo) {
                const video = document.querySelector('video');
                if (video && video.duration) {
                    video.currentTime = video.duration || 9999;
                    video.muted = true;
                    video.playbackRate = 16.0;
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    })();
    "#
}
