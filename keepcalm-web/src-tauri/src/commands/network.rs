use tauri::State;
use std::sync::Arc;
use crate::network::detector::NetworkDetector;
use crate::network::{NetworkStatus, Result};

#[tauri::command]
pub async fn get_network_status(detector: State<'_, Arc<NetworkDetector>>) -> Result<NetworkStatus> {
    Ok(detector.get_status().await)
}

#[tauri::command]
pub async fn run_network_probe(detector: State<'_, Arc<NetworkDetector>>) -> Result<NetworkStatus> {
    detector.run_probe().await
}
