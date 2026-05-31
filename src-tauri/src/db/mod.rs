pub mod archive_repository;
pub mod settings_repository;

use std::error::Error;
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};

use sqlx::migrate::Migrator;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::SqlitePool;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, Runtime};

static MIGRATOR: Migrator = sqlx::migrate!();

pub struct DatabaseState {
    pool: SqlitePool,
}

impl DatabaseState {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub fn archive_repository(&self) -> archive_repository::ArchiveRepository {
        archive_repository::ArchiveRepository::new(self.pool.clone())
    }

    pub fn settings_repository(&self) -> settings_repository::SettingsRepository {
        settings_repository::SettingsRepository::new(self.pool.clone())
    }
}

#[derive(Debug)]
pub enum DatabaseError {
    ResolvePath(String),
    Io(std::io::Error),
    Sql(sqlx::Error),
    Migration(sqlx::migrate::MigrateError),
}

impl fmt::Display for DatabaseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ResolvePath(message) => write!(f, "failed to resolve database path: {message}"),
            Self::Io(error) => write!(f, "database io error: {error}"),
            Self::Sql(error) => write!(f, "database sql error: {error}"),
            Self::Migration(error) => write!(f, "database migration error: {error}"),
        }
    }
}

impl Error for DatabaseError {}

impl From<std::io::Error> for DatabaseError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<sqlx::Error> for DatabaseError {
    fn from(error: sqlx::Error) -> Self {
        Self::Sql(error)
    }
}

impl From<sqlx::migrate::MigrateError> for DatabaseError {
    fn from(error: sqlx::migrate::MigrateError) -> Self {
        Self::Migration(error)
    }
}

pub fn resolve_database_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, DatabaseError> {
    app.path()
        .resolve("wallhaven.sqlite", BaseDirectory::AppLocalData)
        .map_err(|error| DatabaseError::ResolvePath(error.to_string()))
}

pub async fn initialize_for_app<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<DatabaseState, DatabaseError> {
    let database_path = resolve_database_path(app)?;
    initialize_for_path(&database_path).await
}

pub async fn initialize_for_path(database_path: &Path) -> Result<DatabaseState, DatabaseError> {
    if let Some(parent_dir) = database_path.parent() {
        fs::create_dir_all(parent_dir)?;
    }

    let connect_options = SqliteConnectOptions::new()
        .filename(database_path)
        .create_if_missing(true);

    let pool = SqlitePool::connect_with(connect_options).await?;
    apply_migrations(&pool).await?;

    Ok(DatabaseState::new(pool))
}

pub async fn apply_migrations(pool: &SqlitePool) -> Result<(), DatabaseError> {
    MIGRATOR.run(pool).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{apply_migrations, initialize_for_path};
    use sqlx::{query, query_scalar};

    async fn table_columns(pool: &sqlx::SqlitePool, table_name: &str) -> Vec<String> {
        query_scalar::<_, String>(&format!(
            "SELECT name FROM pragma_table_info('{}') ORDER BY cid",
            table_name
        ))
        .fetch_all(pool)
        .await
        .unwrap()
    }

    #[test]
    fn initialize_for_path_creates_required_tables() {
        tauri::async_runtime::block_on(async {
            let temp_dir = tempfile::tempdir().unwrap();
            let database_path = temp_dir.path().join("wallhaven.sqlite");
            let database = initialize_for_path(&database_path).await.unwrap();

            assert_eq!(
                table_columns(database.pool(), "wallpapers").await,
                vec![
                    "wallpaper_id",
                    "source_url",
                    "file_name",
                    "relative_file_path",
                    "download_base_dir",
                    "download_root_path",
                    "created_at",
                    "purity",
                    "category",
                    "tags",
                    "is_favorite",
                ]
            );
            assert_eq!(
                table_columns(database.pool(), "download_jobs").await,
                vec![
                    "id",
                    "wallpaper_id",
                    "source_url",
                    "file_name",
                    "relative_file_path",
                    "status",
                    "failure_reason",
                    "created_at",
                ]
            );
            assert_eq!(
                table_columns(database.pool(), "app_settings").await,
                vec!["key", "value"]
            );

            database.pool().close().await;
        });
    }

    #[test]
    fn apply_migrations_is_idempotent() {
        tauri::async_runtime::block_on(async {
            let temp_dir = tempfile::tempdir().unwrap();
            let database_path = temp_dir.path().join("wallhaven.sqlite");
            let database = initialize_for_path(&database_path).await.unwrap();

            query(
                "INSERT INTO wallpapers (wallpaper_id, source_url, file_name, relative_file_path, download_base_dir, download_root_path) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind("wh-1")
            .bind("https://wallhaven.cc/w/wh-1")
            .bind("wh-1.jpg")
            .bind("wallpapers/wh-1.jpg")
            .bind("AppLocalData")
            .bind::<Option<String>>(None)
            .execute(database.pool())
            .await
            .unwrap();

            apply_migrations(database.pool()).await.unwrap();
            apply_migrations(database.pool()).await.unwrap();

            let wallpaper_count: i64 = query_scalar("SELECT COUNT(*) FROM wallpapers")
                .fetch_one(database.pool())
                .await
                .unwrap();

            assert_eq!(wallpaper_count, 1);
            assert_eq!(
                table_columns(database.pool(), "wallpapers").await,
                vec![
                    "wallpaper_id",
                    "source_url",
                    "file_name",
                    "relative_file_path",
                    "download_base_dir",
                    "download_root_path",
                    "created_at",
                    "purity",
                    "category",
                    "tags",
                    "is_favorite",
                ]
            );
            assert_eq!(
                table_columns(database.pool(), "download_jobs").await,
                vec![
                    "id",
                    "wallpaper_id",
                    "source_url",
                    "file_name",
                    "relative_file_path",
                    "status",
                    "failure_reason",
                    "created_at",
                ]
            );
            assert_eq!(
                table_columns(database.pool(), "app_settings").await,
                vec!["key", "value"]
            );

            database.pool().close().await;
        });
    }
}
