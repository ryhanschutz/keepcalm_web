use serde::{Serialize, Deserialize};
use tokio::io::{AsyncRead, AsyncWrite};
use async_trait::async_trait;
use url::Url;

pub mod tor;
pub mod detector;
pub mod doh;
pub mod ech;
pub mod ws_tunnel;
pub mod obfs;
pub mod chain;

pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;

pub trait AsyncReadWrite: AsyncRead + AsyncWrite + Unpin + Send {}
impl<T: AsyncRead + AsyncWrite + Unpin + Send> AsyncReadWrite for T {}

#[async_trait]
pub trait NetworkLayer: Send + Sync {
    async fn probe(&self) -> Result<bool>;
    async fn connect(&self, url: &Url) -> Result<Box<dyn AsyncReadWrite>>;
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum BypassMode {
    Auto,
    Tor,
    TorBridge,
    VPN,
    Direct,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum NetworkProfile {
    Open,
    DnsBased,
    SniFiltered,
    DpiActive,
    Restricted,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkStatus {
    pub profile: NetworkProfile,
    pub bypass_active: bool,
    pub active_layer: String, // "Direct", "Tor", "Tor (Bridge)", "Tor (Ofuscado)", etc.
    pub connected: bool,
    pub latency_ms: u32,
}

impl NetworkStatus {
    pub fn disconnected() -> Self {
        Self {
            profile: NetworkProfile::Unknown,
            bypass_active: false,
            active_layer: "Disconnected".to_string(),
            connected: false,
            latency_ms: 0,
        }
    }
}