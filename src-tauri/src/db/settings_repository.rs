use std::error::Error;
use std::fmt;

use sqlx::{query, query_scalar, SqlitePool};

const CUSTOM_DOWNLOAD_DIRECTORY_KEY: &str = "custom_download_directory";

#[derive(Clone)]
pub struct SettingsRepository {
    pool: SqlitePool,
}

impl SettingsRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn load_custom_download_directory(&self) -> SettingsStoreResult<Option<String>> {
        query_scalar::<_, String>("SELECT value FROM app_settings WHERE key = ?")
            .bind(CUSTOM_DOWNLOAD_DIRECTORY_KEY)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_sql_error)
    }

    pub async fn save_custom_download_directory(
        &self,
        custom_download_directory: Option<&str>,
    ) -> SettingsStoreResult<()> {
        match custom_download_directory {
            Some(path) => {
                query(
                    r#"
                    INSERT INTO app_settings (key, value)
                    VALUES (?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                    "#,
                )
                .bind(CUSTOM_DOWNLOAD_DIRECTORY_KEY)
                .bind(path)
                .execute(&self.pool)
                .await
                .map_err(map_sql_error)?;
            }
            None => {
                query("DELETE FROM app_settings WHERE key = ?")
                    .bind(CUSTOM_DOWNLOAD_DIRECTORY_KEY)
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
            repository.save_custom_download_directory(None).await.unwrap();

            assert_eq!(repository.load_custom_download_directory().await.unwrap(), None);
        });
    }
}
