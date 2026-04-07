use tauri::{AppHandle, WebviewWindowBuilder, WebviewUrl, Runtime};

#[tauri::command]
pub async fn create_pip_window<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    title: String,
) -> Result<(), String> {
    let pip_id = format!("pip-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs());
    
    println!("[KeepCalm] Criando MiniPlayer PiP: {} -> {}", title, url);

    let window = WebviewWindowBuilder::new(&app, &pip_id, WebviewUrl::External(url.parse::<url::Url>().map_err(|e| e.to_string())?))
        .title(&title)
        .inner_size(400.0, 225.0)
        .always_on_top(true)
        .decorations(false)
        .transparent(true)
        .build()
        .map_err(|e| e.to_string())?;

    // Aplicar Proteção Anti-Capture (Veyon-proof)
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WDA_EXCLUDEFROMCAPTURE};
        use windows::Win32::Foundation::HWND;

        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                let _ = SetWindowDisplayAffinity(HWND(hwnd.0 as _), WDA_EXCLUDEFROMCAPTURE);
                println!("[KeepCalm] PiP Anti-Capture ATIVADA para janela {}", pip_id);
            }
        }
    }

    Ok(())
}
