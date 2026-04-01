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
}

impl TorLayer {
    pub fn new(use_bridges: bool) -> Self {
        Self {
            client: Arc::new(Mutex::new(None)),
            use_bridges,
        }
    }

    async fn get_or_init_client(&self) -> Result<TorClient<PreferredRuntime>> {
        let mut client_lock = self.client.lock().await;
        if let Some(client) = &*client_lock {
            return Ok(client.clone());
        }

        if self.use_bridges {
            return Err("Modo bridge não está disponível nesta build local de testes".into());
        }

        let config_builder = TorClientConfig::builder();
        let config = config_builder.build()?;

        let client = TorClient::builder()
            .config(config)
            .create_unbootstrapped()?;
        
        match tokio::time::timeout(Duration::from_secs(15), client.bootstrap()).await {
            Ok(bootstrap_res) => {
                bootstrap_res?;
                *client_lock = Some(client.clone());
                Ok(client)
            }
            Err(_) => {
                Err("Bootstrap do Tor expirou (15s)".into())
            }
        }
    }

    pub fn get_socks_url(&self) -> String {
        // TODO: Obter porta real do listener do Arti
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
