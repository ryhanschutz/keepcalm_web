use tauri::State;
use std::sync::Arc;
use crate::network::detector::NetworkDetector;
use crate::network::{BypassMode, NetworkStatus};

#[tauri::command]
pub async fn get_network_status(detector: State<'_, Arc<NetworkDetector>>) -> std::result::Result<NetworkStatus, String> {
    Ok(detector.get_status().await)
}

#[tauri::command]
pub async fn run_network_probe(detector: State<'_, Arc<NetworkDetector>>) -> std::result::Result<NetworkStatus, String> {
    detector.run_probe().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_bypass_mode(
    mode: BypassMode,
    detector: State<'_, Arc<NetworkDetector>>,
) -> std::result::Result<NetworkStatus, String> {
    detector.set_bypass_mode(mode).await;
    detector.run_probe().await.map_err(|e| e.to_string())
}
