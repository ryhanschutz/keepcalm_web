use crate::network::{NetworkLayer, Result, AsyncReadWrite};
use url::Url;
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};

pub struct DohLayer {
    pub provider_url: String,
}

impl DohLayer {
    pub fn new(provider_url: &str) -> Self {
        Self {
            provider_url: provider_url.to_string(),
        }
    }
}

#[async_trait::async_trait]
impl NetworkLayer for DohLayer {
    async fn probe(&self) -> Result<bool> {
        let parsed = Url::parse(&self.provider_url)?;
        let host = parsed
            .host_str()
            .ok_or_else(|| "DoH provider sem hostname".to_string())?;
        let port = parsed.port_or_known_default().unwrap_or(443);

        let target = format!("{host}:{port}");
        let connected = timeout(Duration::from_secs(3), TcpStream::connect(target)).await;
        Ok(matches!(connected, Ok(Ok(_))))
    }

    async fn connect(&self, _url: &Url) -> Result<Box<dyn AsyncReadWrite>> {
        // Implementar a conexão via DoH encapsulada
        Err("Não implementado".into())
    }
}
