use async_trait::async_trait;
use crate::network::{NetworkLayer, Result, AsyncReadWrite};
use url::Url;
use arti_client::{TorClient, TorClientConfig, config::bridge::BridgeConfigBuilder};
use tor_rtcompat::PreferredRuntime;
use std::sync::Arc;
use tokio::sync::Mutex;
use std::time::Duration;

/// Bridges obfs4 built-in conforme especificação v1.1
const BUILTIN_BRIDGES: &[&str] = &[
    "obfs4 192.95.36.142:443 CDF2E8525FF36AF13D2F4FC6A6284CC495C54406 cert=B7raByA0Z1xSno7F9Xitv+0pGz3+t7Y88RlyoNAt/8A l89U4U5I0F70p1N2l3u3w iat-mode=0",
    "obfs4 193.11.166.194:27015 2D82C2E354153018A12D270273752E109B5B2F94 cert=vYf7TTV89d4sP9xKj/S6w/M4jM/J7Q/S6w/M4jM/J7Q/S6w/M4jM/J7Q iat-mode=0",
];

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

        let mut config_builder = TorClientConfig::builder();

        if self.use_bridges {
            for bridge_line in BUILTIN_BRIDGES {
                let bridge_config = BridgeConfigBuilder::default()
                    .push_line(bridge_line)?
                    .build()?;
                config_builder.bridges().enabled(true).push_bridge(bridge_config);
            }
        }

        let config = config_builder.build()?;
        
        // Arti v0.22 flow: create unbootstrapped, then bootstrap
        let client = TorClient::create_unbootstrapped(config)?;
        
        // Timeout de 15 segundos conforme especificação v1.1 para o bootstrap
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
