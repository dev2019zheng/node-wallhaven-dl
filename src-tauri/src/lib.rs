mod commands;
pub mod models;
pub mod services;

use crate::models::download::DownloadStrategy;

#[tauri::command]
fn get_default_download_strategy() -> DownloadStrategy {
    services::path_service::default_download_strategy()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_default_download_strategy,
            commands::search::search_wallpapers
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use crate::models::download::DownloadStrategy;

    use super::get_default_download_strategy;

    #[test]
    fn default_download_strategy_command_uses_app_local_data_wallpapers() {
        assert_eq!(
            get_default_download_strategy(),
            DownloadStrategy::new("AppLocalData", "wallpapers")
        );
    }
}
