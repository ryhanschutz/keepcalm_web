use crate::network::{NetworkLayer, Result, AsyncReadWrite};
use url::Url;

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
    fn name(&self) -> &'static str {
        "DNS-over-HTTPS"
    }

    async fn probe(&self) -> Result<bool> {
        // Enviar requisição DoH simplificada de teste
        // Timeout de 3s obrigatório pela spec
        Ok(true) // Mock por enquanto
    }

    async fn connect(&self, _url: &Url) -> Result<Box<dyn AsyncReadWrite>> {
        // Implementar a conexão via DoH encapsulada
        Err("Não implementado".into())
    }

    fn priority(&self) -> u8 {
        1
    }
}
