use crate::network::{BypassMode, NetworkProfile, NetworkStatus, Result, NetworkLayer};
use crate::network::tor::TorLayer;
use crate::network::doh::DohLayer;
use std::time::Instant;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct NetworkDetector {
    tor_direct: Arc<TorLayer>,
    tor_bridges: Arc<TorLayer>,
    doh_layer: Arc<DohLayer>,
    current_status: Arc<Mutex<NetworkStatus>>,
    bypass_mode: Arc<Mutex<BypassMode>>,
}

impl NetworkDetector {
    pub fn new() -> Self {
        Self {
            tor_direct: Arc::new(TorLayer::new(false)),
            tor_bridges: Arc::new(TorLayer::new(true)),
            doh_layer: Arc::new(DohLayer::new("https://cloudflare-dns.com/dns-query")),
            current_status: Arc::new(Mutex::new(NetworkStatus::disconnected())),
            bypass_mode: Arc::new(Mutex::new(BypassMode::Auto)),
        }
    }

    pub async fn run_probe(&self, app_handle: Option<&tauri::AppHandle>) -> Result<NetworkStatus> {
        let start = Instant::now();
        let bypass_mode = self.bypass_mode.lock().await.clone();
        
        let status = match bypass_mode {
            BypassMode::Direct => {
                let is_doh_ok = self.doh_layer.probe().await.unwrap_or(false);
                let is_direct_ok = self.test_direct_connection().await;
                NetworkStatus {
                    profile: if is_direct_ok && is_doh_ok { NetworkProfile::Open } else { NetworkProfile::Restricted },
                    bypass_active: false,
                    active_layer: if is_direct_ok { "Direct + DoH".to_string() } else { "Direct (Bloqueado)".to_string() },
                    connected: is_direct_ok,
                    latency_ms: start.elapsed().as_millis() as u32,
                }
            }
            BypassMode::Tor => {
                let is_tor_ok = self.tor_direct.get_or_init_client(app_handle).await.map(|_| true).unwrap_or(false);
                NetworkStatus {
                    profile: if is_tor_ok { NetworkProfile::SniFiltered } else { NetworkProfile::Restricted },
                    bypass_active: is_tor_ok,
                    active_layer: if is_tor_ok { "Tor ativo".to_string() } else { "Conectando ao Tor...".to_string() },
                    connected: is_tor_ok,
                    latency_ms: start.elapsed().as_millis() as u32,
                }
            }
            BypassMode::TorBridge => {
                let bridges = self.fetch_bridges().await;
                let _ = self.tor_bridges.set_bridges(bridges).await;
                
                let is_bridge_ok = self.tor_bridges.get_or_init_client(app_handle).await.map(|_| true).unwrap_or(false);
                NetworkStatus {
                    profile: if is_bridge_ok { NetworkProfile::DpiActive } else { NetworkProfile::Restricted },
                    bypass_active: is_bridge_ok,
                    active_layer: if is_bridge_ok { "Tor ativo (bridge)".to_string() } else { "Conectando via Bridge...".to_string() },
                    connected: is_bridge_ok,
                    latency_ms: start.elapsed().as_millis() as u32,
                }
            }
            BypassMode::VPN => {
                NetworkStatus {
                    profile: NetworkProfile::Unknown,
                    bypass_active: false,
                    active_layer: "VPN (em desenvolvimento)".to_string(),
                    connected: false,
                    latency_ms: start.elapsed().as_millis() as u32,
                }
            }
            BypassMode::Auto => {
                let is_direct_ok = self.test_direct_connection().await;
                if is_direct_ok {
                    NetworkStatus {
                        profile: NetworkProfile::Open,
                        bypass_active: false,
                        active_layer: "Auto: Direct".to_string(),
                        connected: true,
                        latency_ms: start.elapsed().as_millis() as u32,
                    }
                } else {
                    let is_tor_ok = self.tor_direct.get_or_init_client(app_handle).await.map(|_| true).unwrap_or(false);
                    if is_tor_ok {
                        NetworkStatus {
                            profile: NetworkProfile::SniFiltered,
                            bypass_active: true,
                            active_layer: "Auto: Tor ativo".to_string(),
                            connected: true,
                            latency_ms: start.elapsed().as_millis() as u32,
                        }
                    } else {
                        let bridges = self.fetch_bridges().await;
                        let _ = self.tor_bridges.set_bridges(bridges).await;
                        let is_bridge_ok = self.tor_bridges.get_or_init_client(app_handle).await.map(|_| true).unwrap_or(false);
                        
                        NetworkStatus {
                            profile: if is_bridge_ok { NetworkProfile::DpiActive } else { NetworkProfile::Restricted },
                            bypass_active: is_bridge_ok,
                            active_layer: if is_bridge_ok { "Auto: Tor Bridge".to_string() } else { "Rede Bloqueada".to_string() },
                            connected: is_bridge_ok,
                            latency_ms: start.elapsed().as_millis() as u32,
                        }
                    }
                }
            }
        };

        let mut current = self.current_status.lock().await;
        *current = status.clone();
        Ok(status)
    }

    async fn fetch_bridges(&self) -> Vec<String> {
        // Incluímos pontes Vanilla (sem obfs4) como failover se o binário obfs4proxy estiver faltando.
        let fallback = vec![
            // Vanilla Bridge (just IP:Port)
            "192.95.36.142:443 CF7045117F2043678F342845BBBC0990C9D1A968".to_string(),
            // obfs4 Bridge (requires binary)
            "obfs4 85.31.186.26:443 011F6473C17715D291EF076646549E3E4B0B91C1 cert=7XDR3p7nAnpLAEAV6m6zVA iat-mode=1".to_string(),
        ];
        
        fallback
    }

    async fn test_direct_connection(&self) -> bool {
        match tokio::time::timeout(
            std::time::Duration::from_secs(1),
            tokio::net::TcpStream::connect("8.8.8.8:53")
        ).await {
            Ok(Ok(_)) => true,
            _ => false,
        }
    }

    pub async fn get_status(&self) -> NetworkStatus {
        self.current_status.lock().await.clone()
    }

    pub async fn set_bypass_mode(&self, mode: BypassMode) {
        let mut current = self.bypass_mode.lock().await;
        *current = mode;
    }

    pub async fn get_active_proxy(&self) -> Option<String> {
        let status = self.get_status().await;
        if status.active_layer.contains("Tor") && status.connected {
            if status.active_layer.to_lowercase().contains("bridge") {
                return self.tor_bridges.get_proxy_url().await;
            }
            return self.tor_direct.get_proxy_url().await;
        }
        None
    }
}
