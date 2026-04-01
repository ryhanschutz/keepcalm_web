use crate::network::{NetworkProfile, NetworkStatus, Result, NetworkLayer};
use crate::network::tor::TorLayer;
use std::time::Instant;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct NetworkDetector {
    tor_direct: Arc<TorLayer>,
    tor_bridges: Arc<TorLayer>,
    current_status: Arc<Mutex<NetworkStatus>>,
}

impl NetworkDetector {
    pub fn new() -> Self {
        Self {
            tor_direct: Arc::new(TorLayer::new(false)),
            tor_bridges: Arc::new(TorLayer::new(true)),
            current_status: Arc::new(Mutex::new(NetworkStatus::disconnected())),
        }
    }

    pub async fn run_probe(&self) -> Result<NetworkStatus> {
        let start = Instant::now();
        
        // 1. Tentar conexão direta (Detectar Perfil)
        let is_direct_ok = self.test_direct_connection().await;
        
        let status = if is_direct_ok {
            NetworkStatus {
                profile: NetworkProfile::Open,
                bypass_active: false,
                active_layer: "Direct".to_string(),
                connected: true,
                latency_ms: start.elapsed().as_millis() as u32,
            }
        } else {
            // Tentativa 1: Tor Direto (Stealth)
            if self.tor_direct.probe().await.unwrap_or(false) {
                NetworkStatus {
                    profile: NetworkProfile::SniFiltered,
                    bypass_active: true,
                    active_layer: "Tor ativo".to_string(),
                    connected: true,
                    latency_ms: start.elapsed().as_millis() as u32,
                }
            } else {
                // Tentativa 2: Tor com Bridges (obfs4)
                if self.tor_bridges.probe().await.unwrap_or(false) {
                    NetworkStatus {
                        profile: NetworkProfile::DpiActive,
                        bypass_active: true,
                        active_layer: "Tor ativo (bridge)".to_string(),
                        connected: true,
                        latency_ms: start.elapsed().as_millis() as u32,
                    }
                } else {
                    // Falha total
                    NetworkStatus {
                        profile: NetworkProfile::Restricted,
                        bypass_active: false,
                        active_layer: "Bloqueado".to_string(),
                        connected: false,
                        latency_ms: start.elapsed().as_millis() as u32,
                    }
                }
            }
        };

        let mut current = self.current_status.lock().await;
        *current = status.clone();
        Ok(status)
    }

    async fn test_direct_connection(&self) -> bool {
        match tokio::time::timeout(
            std::time::Duration::from_secs(2),
            tokio::net::TcpStream::connect("1.1.1.1:443")
        ).await {
            Ok(Ok(_)) => true,
            _ => false,
        }
    }

    pub async fn get_status(&self) -> NetworkStatus {
        self.current_status.lock().await.clone()
    }

    pub async fn get_active_proxy(&self) -> Option<String> {
        let status = self.get_status().await;
        if status.active_layer.contains("Tor") {
            if status.active_layer.contains("bridge") {
                return self.tor_bridges.get_proxy_url().await;
            }
            return self.tor_direct.get_proxy_url().await;
        }
        None
    }
}
