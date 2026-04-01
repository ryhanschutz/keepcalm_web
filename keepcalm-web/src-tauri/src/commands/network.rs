use tauri::State;
use std::sync::Arc;
use crate::network::detector::NetworkDetector;
use crate::network::NetworkStatus;

#[tauri::command]
pub async fn get_network_status(detector: State<'_, Arc<NetworkDetector>>) -> std::result::Result<NetworkStatus, String> {
    Ok(detector.get_status().await)
}

#[tauri::command]
pub async fn run_network_probe(detector: State<'_, Arc<NetworkDetector>>) -> std::result::Result<NetworkStatus, String> {
    detector.run_probe().await.map_err(|e| e.to_string())
}
