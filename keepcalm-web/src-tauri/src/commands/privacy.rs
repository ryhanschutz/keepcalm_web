use crate::privacy::{PrivacyStats, PrivacyTelemetry};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn get_privacy_stats(
    telemetry: State<'_, Arc<PrivacyTelemetry>>,
) -> std::result::Result<PrivacyStats, String> {
    Ok(telemetry.get_stats().await)
}

#[tauri::command]
pub async fn clear_privacy_stats(
    telemetry: State<'_, Arc<PrivacyTelemetry>>,
) -> std::result::Result<PrivacyStats, String> {
    Ok(telemetry.clear().await)
}
