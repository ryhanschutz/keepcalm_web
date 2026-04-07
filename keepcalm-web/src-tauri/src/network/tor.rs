use async_trait::async_trait;
use crate::network::{NetworkLayer, Result, AsyncReadWrite};
use url::Url;
use arti_client::{TorClient, TorClientConfig};
use tor_rtcompat::PreferredRuntime;
use std::sync::Arc;
use tokio::sync::Mutex;
use std::time::Duration;

pub struct TorLayer {
    client: Arc<Mutex<Option<TorClient<PreferredRuntime>>>>,
    use_bridges: bool,
    bridges: Arc<Mutex<Vec<String>>>,
}

impl TorLayer {
    pub fn new(use_bridges: bool) -> Self {
        Self {
            client: Arc::new(Mutex::new(None)),
            use_bridges,
            bridges: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub async fn set_bridges(&self, bridges: Vec<String>) -> Result<()> {
        let mut b = self.bridges.lock().await;
        *b = bridges;
        let mut client_lock = self.client.lock().await;
        *client_lock = None;
        Ok(())
    }

    async fn get_or_init_client(&self) -> Result<TorClient<PreferredRuntime>> {
        // Primeiro: verificar se já existe cliente sem segurar o lock por muito tempo
        {
            let client_lock = self.client.lock().await;
            if let Some(client) = &*client_lock {
                return Ok(client.clone());
            }
        } // lock liberado aqui

        // Construir config sem o lock
        let mut config_builder = TorClientConfig::builder();

        if self.use_bridges {
            let bridges = self.bridges.lock().await.clone(); // clone e libera o lock
            
            println!("[KeepCalm] Configurando {} bridges...", bridges.len());
            
            if bridges.is_empty() {
                return Err("Nenhuma bridge configurada".into());
            }

            for bridge_line in bridges.iter() {
                if let Ok(bridge_cfg) = bridge_line.parse::<arti_client::config::BridgeConfigBuilder>() {
                    config_builder.bridges().bridges().push(bridge_cfg);
                }
            }

            config_builder.address_filter().allow_onion_addrs(true);
        }

        let config = config_builder.build()?;
        let client = TorClient::builder()
            .config(config)
            .create_unbootstrapped()?;
        
        let timeout_duration = if self.use_bridges {
            Duration::from_secs(45)
        } else {
            Duration::from_secs(15)
        };

        println!("[KeepCalm] Iniciando bootstrap (Timeout: {:?})...", timeout_duration);
        
        // Bootstrap acontece SEM o lock — outros podem chamar get_proxy_url normalmente
        match tokio::time::timeout(timeout_duration, client.bootstrap()).await {
            Ok(Ok(_)) => {
                println!("[KeepCalm] Bootstrap com sucesso.");
                // Só agora readquire o lock para salvar o cliente
                let mut client_lock = self.client.lock().await;
                *client_lock = Some(client.clone());
                Ok(client)
            }
            Ok(Err(e)) => {
                println!("[KeepCalm] Erro no bootstrap: {}", e);
                Err(format!("Falha no bootstrap: {}", e).into())
            }
            Err(_) => {
                println!("[KeepCalm] Bootstrap expirou.");
                Err("Bootstrap do Tor expirou".into())
            }
        }
    }

    pub fn get_socks_url(&self) -> String {
        "socks5h://127.0.0.1:9150".to_string()
    }

    pub async fn get_proxy_url(&self) -> Option<String> {
        let client_lock = self.client.lock().await;
        if client_lock.is_some() {
            Some(self.get_socks_url())
        } else {
            None
        }
    }
}

#[async_trait]
impl NetworkLayer for TorLayer {
    async fn probe(&self) -> Result<bool> {
        match self.get_or_init_client().await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    async fn connect(&self, url: &Url) -> Result<Box<dyn AsyncReadWrite>> {
        let client = self.get_or_init_client().await?;
        let host = url.host_str().ok_or("Host inválido")?;
        let port = url.port_or_known_default().ok_or("Porta inválida")?;
        
        let stream = client.connect((host, port)).await?;
        Ok(Box::new(stream))
    }
}
