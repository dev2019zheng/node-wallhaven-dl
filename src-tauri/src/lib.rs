mod commands;
pub mod db;
pub mod models;
pub mod services;

use crate::models::download::DownloadStrategy;
use crate::services::download_manager::DownloadManagerState;
use tauri::Manager;

#[tauri::command]
fn get_default_download_strategy() -> DownloadStrategy {
    services::path_service::default_download_strategy()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();
            let database_state =
                tauri::async_runtime::block_on(db::initialize_for_app(&app_handle))
                    .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;
            let download_manager_state =
                DownloadManagerState::new(database_state.archive_repository());
            app.manage(database_state);
            app.manage(download_manager_state);
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_default_download_strategy,
            commands::downloads::download_wallpaper,
            commands::downloads::list_downloads,
            commands::downloads::delete_download_task,
            commands::gallery::list_gallery_items,
            commands::gallery::set_gallery_favorite,
            commands::gallery::update_gallery_tags,
            commands::gallery::delete_gallery_item,
            commands::media::load_remote_image,
            commands::search::search_wallpapers,
            commands::settings::get_download_directory_settings,
            commands::settings::save_download_directory_settings,
            commands::settings::get_network_proxy_settings,
            commands::settings::save_network_proxy_settings,
            commands::settings::diagnose_wallhaven_access
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
