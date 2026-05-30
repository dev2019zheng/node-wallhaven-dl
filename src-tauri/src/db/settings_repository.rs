use std::error::Error;
use std::fmt;

use sqlx::{query, query_scalar, SqlitePool};

use crate::models::settings::NetworkProxySettings;

const CUSTOM_DOWNLOAD_DIRECTORY_KEY: &str = "custom_download_directory";
const NETWORK_PROXY_SETTINGS_KEY: &str = "network_proxy_settings";

#[derive(Clone)]
pub struct SettingsRepository {
    pool: SqlitePool,
}

impl SettingsRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn load_custom_download_directory(&self) -> SettingsStoreResult<Option<String>> {
        self.load_setting(CUSTOM_DOWNLOAD_DIRECTORY_KEY).await
    }

    pub async fn save_custom_download_directory(
        &self,
        custom_download_directory: Option<&str>,
    ) -> SettingsStoreResult<()> {
        self.save_setting(CUSTOM_DOWNLOAD_DIRECTORY_KEY, custom_download_directory)
            .await
    }

    pub async fn load_network_proxy_settings(
        &self,
    ) -> SettingsStoreResult<Option<NetworkProxySettings>> {
        let Some(raw_value) = self.load_setting(NETWORK_PROXY_SETTINGS_KEY).await? else {
            return Ok(None);
        };

        let settings =
            serde_json::from_str::<NetworkProxySettings>(&raw_value).map_err(|error| {
                SettingsStoreError::Persistence {
                    message: format!("failed to decode saved network proxy settings: {error}"),
                }
            })?;

        Ok(Some(settings))
    }

    pub async fn save_network_proxy_settings(
        &self,
        proxy_settings: Option<&NetworkProxySettings>,
    ) -> SettingsStoreResult<()> {
        let serialized = match proxy_settings {
            Some(settings) => {
                let normalized =
                    settings
                        .normalized()
                        .map_err(|error| SettingsStoreError::Persistence {
                            message: format!("failed to normalize network proxy settings: {error}"),
                        })?;
                Some(serde_json::to_string(&normalized).map_err(|error| {
                    SettingsStoreError::Persistence {
                        message: format!("failed to encode network proxy settings: {error}"),
                    }
                })?)
            }
            None => None,
        };

        self.save_setting(NETWORK_PROXY_SETTINGS_KEY, serialized.as_deref())
            .await
    }

    async fn load_setting(&self, key: &str) -> SettingsStoreResult<Option<String>> {
        query_scalar::<_, String>("SELECT value FROM app_settings WHERE key = ?")
            .bind(key)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_sql_error)
    }

    async fn save_setting(&self, key: &str, value: Option<&str>) -> SettingsStoreResult<()> {
        match value {
            Some(value) => {
                query(
                    r#"
                    INSERT INTO app_settings (key, value)
                    VALUES (?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                    "#,
                )
                .bind(key)
                .bind(value)
                .execute(&self.pool)
                .await
                .map_err(map_sql_error)?;
            }
            None => {
                query("DELETE FROM app_settings WHERE key = ?")
                    .bind(key)
                    .execute(&self.pool)
                    .await
                    .map_err(map_sql_error)?;
            }
        }

        Ok(())
    }
}

pub type SettingsStoreResult<T> = Result<T, SettingsStoreError>;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SettingsStoreError {
    Persistence { message: String },
}

impl fmt::Display for SettingsStoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Persistence { message } => {
                write!(f, "settings store persistence error: {message}")
            }
        }
    }
}

impl Error for SettingsStoreError {}

fn map_sql_error(error: sqlx::Error) -> SettingsStoreError {
    SettingsStoreError::Persistence {
        message: error.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use crate::db::initialize_for_path;
    use crate::models::settings::{NetworkProxyScheme, NetworkProxySettings};

    #[test]
    fn sqlite_settings_repository_saves_and_loads_the_custom_download_directory() {
        tauri::async_runtime::block_on(async {
            let temp_dir = tempfile::tempdir().unwrap();
            let database = initialize_for_path(&temp_dir.path().join("wallhaven.sqlite"))
                .await
                .unwrap();
            let repository = database.settings_repository();

            repository
                .save_custom_download_directory(Some("/Users/test/Pictures/Wallhaven"))
                .await
                .unwrap();

            assert_eq!(
                repository.load_custom_download_directory().await.unwrap(),
                Some("/Users/test/Pictures/Wallhaven".into())
            );
        });
    }

    #[test]
    fn sqlite_settings_repository_clears_the_custom_download_directory() {
        tauri::async_runtime::block_on(async {
            let temp_dir = tempfile::tempdir().unwrap();
            let database = initialize_for_path(&temp_dir.path().join("wallhaven.sqlite"))
                .await
                .unwrap();
            let repository = database.settings_repository();

            repository
                .save_custom_download_directory(Some("/Users/test/Pictures/Wallhaven"))
                .await
                .unwrap();
            repository
                .save_custom_download_directory(None)
                .await
                .unwrap();

            assert_eq!(
                repository.load_custom_download_directory().await.unwrap(),
                None
            );
        });
    }

    #[test]
    fn sqlite_settings_repository_saves_and_loads_the_network_proxy_settings() {
        tauri::async_runtime::block_on(async {
            let temp_dir = tempfile::tempdir().unwrap();
            let database = initialize_for_path(&temp_dir.path().join("wallhaven.sqlite"))
                .await
                .unwrap();
            let repository = database.settings_repository();

            repository
                .save_network_proxy_settings(Some(&NetworkProxySettings {
                    scheme: NetworkProxyScheme::Socks5,
                    address: "127.0.0.1:7897".into(),
                }))
                .await
                .unwrap();

            assert_eq!(
                repository.load_network_proxy_settings().await.unwrap(),
                Some(NetworkProxySettings {
                    scheme: NetworkProxyScheme::Socks5,
                    address: "127.0.0.1:7897".into(),
                })
            );
        });
    }

    #[test]
    fn sqlite_settings_repository_clears_the_network_proxy_settings() {
        tauri::async_runtime::block_on(async {
            let temp_dir = tempfile::tempdir().unwrap();
            let database = initialize_for_path(&temp_dir.path().join("wallhaven.sqlite"))
                .await
                .unwrap();
            let repository = database.settings_repository();

            repository
                .save_network_proxy_settings(Some(&NetworkProxySettings {
                    scheme: NetworkProxyScheme::Http,
                    address: "127.0.0.1:7897".into(),
                }))
                .await
                .unwrap();
            repository.save_network_proxy_settings(None).await.unwrap();

            assert_eq!(
                repository.load_network_proxy_settings().await.unwrap(),
                None
            );
        });
    }
}
