use sqlx::{query, query_scalar, sqlite::SqliteRow, Row, SqlitePool};

use crate::models::download::ArchiveRecord;
use crate::models::gallery::{GalleryArchivePage, GalleryArchiveRecord, GalleryListQuery};
use crate::services::archive_service::{
    ArchiveStoreError, ArchiveStoreResult, ArchiveWriteOutcome,
};

const ARCHIVE_SELECT_COLUMNS: &str =
    "wallpaper_id, source_url, file_name, relative_file_path, download_base_dir, download_root_path";
const GALLERY_SELECT_COLUMNS: &str =
    "wallpaper_id, source_url, file_name, relative_file_path, download_base_dir, download_root_path, created_at";

#[derive(Clone)]
pub struct ArchiveRepository {
    pool: SqlitePool,
}

impl ArchiveRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn upsert(&self, record: ArchiveRecord) -> ArchiveStoreResult<ArchiveWriteOutcome> {
        let mut transaction = self.pool.begin().await.map_err(map_sql_error)?;

        if let Some(existing_wallpaper_id) = self
            .find_wallpaper_id_by_download_target_tx(
                &mut transaction,
                &record.download_base_dir,
                record.download_root_path.as_deref(),
                &record.relative_file_path,
            )
            .await?
        {
            if existing_wallpaper_id != record.wallpaper_id {
                return Err(ArchiveStoreError::RelativeFilePathConflict {
                    relative_file_path: record.relative_file_path.clone(),
                    existing_wallpaper_id,
                    incoming_wallpaper_id: record.wallpaper_id.clone(),
                });
            }
        }

        let existed = query_scalar::<_, i64>(
            "SELECT EXISTS(SELECT 1 FROM wallpapers WHERE wallpaper_id = ?)",
        )
        .bind(&record.wallpaper_id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(map_sql_error)?
            != 0;

        let execute_result = query(
            r#"
            INSERT INTO wallpapers (
                wallpaper_id,
                source_url,
                file_name,
                relative_file_path,
                download_base_dir,
                download_root_path
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(wallpaper_id) DO UPDATE SET
                source_url = excluded.source_url,
                file_name = excluded.file_name,
                relative_file_path = excluded.relative_file_path,
                download_base_dir = excluded.download_base_dir,
                download_root_path = excluded.download_root_path
            "#,
        )
        .bind(&record.wallpaper_id)
        .bind(&record.source_url)
        .bind(&record.file_name)
        .bind(&record.relative_file_path)
        .bind(&record.download_base_dir)
        .bind(&record.download_root_path)
        .execute(&mut *transaction)
        .await;

        if let Err(error) = execute_result {
            drop(transaction);
            return Err(self.map_upsert_error(error, &record).await);
        }

        transaction.commit().await.map_err(map_sql_error)?;

        Ok(if existed {
            ArchiveWriteOutcome::Updated
        } else {
            ArchiveWriteOutcome::Inserted
        })
    }

    pub async fn find_by_wallpaper_id(
        &self,
        wallpaper_id: &str,
    ) -> ArchiveStoreResult<Option<ArchiveRecord>> {
        query(&format!(
            "SELECT {ARCHIVE_SELECT_COLUMNS} FROM wallpapers WHERE wallpaper_id = ?"
        ))
        .bind(wallpaper_id)
        .fetch_optional(&self.pool)
        .await
        .map(|row| row.map(archive_record_from_row))
        .map_err(map_sql_error)
    }

    pub async fn find_by_download_target(
        &self,
        download_base_dir: &str,
        download_root_path: Option<&str>,
        relative_file_path: &str,
    ) -> ArchiveStoreResult<Option<ArchiveRecord>> {
        query(&format!(
            "SELECT {ARCHIVE_SELECT_COLUMNS} FROM wallpapers WHERE download_base_dir = ? AND COALESCE(download_root_path, '') = COALESCE(?, '') AND relative_file_path = ?"
        ))
        .bind(download_base_dir)
        .bind(download_root_path)
        .bind(relative_file_path)
        .fetch_optional(&self.pool)
        .await
        .map(|row| row.map(archive_record_from_row))
        .map_err(map_sql_error)
    }

    pub async fn list(&self) -> ArchiveStoreResult<Vec<ArchiveRecord>> {
        query(&format!(
            "SELECT {ARCHIVE_SELECT_COLUMNS} FROM wallpapers ORDER BY wallpaper_id"
        ))
        .fetch_all(&self.pool)
        .await
        .map(|rows| rows.into_iter().map(archive_record_from_row).collect())
        .map_err(map_sql_error)
    }

    pub async fn list_gallery_page(
        &self,
        page_query: &GalleryListQuery,
    ) -> ArchiveStoreResult<GalleryArchivePage> {
        let total = query_scalar::<_, i64>("SELECT COUNT(*) FROM wallpapers")
            .fetch_one(&self.pool)
            .await
            .map_err(map_sql_error)?;
        let total = u64::try_from(total).map_err(|_| ArchiveStoreError::Persistence {
            message: format!("wallpaper count overflowed u64: {total}"),
        })?;

        let items = query(&format!(
            "SELECT {GALLERY_SELECT_COLUMNS} FROM wallpapers ORDER BY created_at DESC, wallpaper_id DESC LIMIT ? OFFSET ?"
        ))
        .bind(page_query.sql_limit())
        .bind(page_query.sql_offset())
        .fetch_all(&self.pool)
        .await
        .map(|rows| rows.into_iter().map(gallery_archive_record_from_row).collect())
        .map_err(map_sql_error)?;

        Ok(GalleryArchivePage { items, total })
    }

    async fn find_wallpaper_id_by_download_target(
        &self,
        download_base_dir: &str,
        download_root_path: Option<&str>,
        relative_file_path: &str,
    ) -> ArchiveStoreResult<Option<String>> {
        query_scalar::<_, String>(
            "SELECT wallpaper_id FROM wallpapers WHERE download_base_dir = ? AND COALESCE(download_root_path, '') = COALESCE(?, '') AND relative_file_path = ?",
        )
        .bind(download_base_dir)
        .bind(download_root_path)
        .bind(relative_file_path)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_sql_error)
    }

    async fn find_wallpaper_id_by_download_target_tx(
        &self,
        transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
        download_base_dir: &str,
        download_root_path: Option<&str>,
        relative_file_path: &str,
    ) -> ArchiveStoreResult<Option<String>> {
        query_scalar::<_, String>(
            "SELECT wallpaper_id FROM wallpapers WHERE download_base_dir = ? AND COALESCE(download_root_path, '') = COALESCE(?, '') AND relative_file_path = ?",
        )
        .bind(download_base_dir)
        .bind(download_root_path)
        .bind(relative_file_path)
        .fetch_optional(&mut **transaction)
        .await
        .map_err(map_sql_error)
    }

    async fn map_upsert_error(
        &self,
        error: sqlx::Error,
        record: &ArchiveRecord,
    ) -> ArchiveStoreError {
        if is_relative_file_path_unique_violation(&error) {
            match self
                .find_wallpaper_id_by_download_target(
                    &record.download_base_dir,
                    record.download_root_path.as_deref(),
                    &record.relative_file_path,
                )
                .await
            {
                Ok(Some(existing_wallpaper_id)) => {
                    return ArchiveStoreError::RelativeFilePathConflict {
                        relative_file_path: record.relative_file_path.clone(),
                        existing_wallpaper_id,
                        incoming_wallpaper_id: record.wallpaper_id.clone(),
                    };
                }
                Ok(None) => {}
                Err(fetch_error) => return fetch_error,
            }
        }

        map_sql_error(error)
    }
}

fn archive_record_from_row(row: SqliteRow) -> ArchiveRecord {
    ArchiveRecord {
        wallpaper_id: row.get("wallpaper_id"),
        source_url: row.get("source_url"),
        file_name: row.get("file_name"),
        relative_file_path: row.get("relative_file_path"),
        download_base_dir: row.get("download_base_dir"),
        download_root_path: row.get("download_root_path"),
    }
}

fn gallery_archive_record_from_row(row: SqliteRow) -> GalleryArchiveRecord {
    GalleryArchiveRecord {
        wallpaper_id: row.get("wallpaper_id"),
        source_url: row.get("source_url"),
        file_name: row.get("file_name"),
        relative_file_path: row.get("relative_file_path"),
        download_base_dir: row.get("download_base_dir"),
        download_root_path: row.get("download_root_path"),
        created_at: row.get("created_at"),
    }
}

fn is_relative_file_path_unique_violation(error: &sqlx::Error) -> bool {
    error
        .as_database_error()
        .map(|database_error| database_error.is_unique_violation())
        .unwrap_or(false)
}

fn map_sql_error(error: sqlx::Error) -> ArchiveStoreError {
    ArchiveStoreError::Persistence {
        message: error.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use sqlx::query;

    use crate::db::initialize_for_path;
    use crate::models::download::ArchiveRecord;
    use crate::models::gallery::{GalleryArchiveRecord, GalleryListQuery};
    use crate::services::archive_service::{ArchiveStoreError, ArchiveWriteOutcome};

    fn sample_record() -> ArchiveRecord {
        ArchiveRecord {
            wallpaper_id: "wh-1".into(),
            source_url: "https://wallhaven.cc/w/wh-1".into(),
            file_name: "wh-1.jpg".into(),
            relative_file_path: "wallpapers/wh-1.jpg".into(),
            download_base_dir: "AppLocalData".into(),
            download_root_path: None,
        }
    }

    fn second_record() -> ArchiveRecord {
        ArchiveRecord {
            wallpaper_id: "wh-2".into(),
            source_url: "https://wallhaven.cc/w/wh-2".into(),
            file_name: "wh-2.jpg".into(),
            relative_file_path: "wallpapers/wh-2.jpg".into(),
            download_base_dir: "AppLocalData".into(),
            download_root_path: None,
        }
    }

    #[test]
    fn sqlite_archive_repository_upserts_and_reads_records() {
        tauri::async_runtime::block_on(async {
            let temp_dir = tempfile::tempdir().unwrap();
            let database = initialize_for_path(&temp_dir.path().join("wallhaven.sqlite"))
                .await
                .unwrap();
            let repository = database.archive_repository();
            let record = sample_record();

            assert_eq!(
                repository.upsert(record.clone()).await.unwrap(),
                ArchiveWriteOutcome::Inserted
            );
            assert_eq!(
                repository.find_by_wallpaper_id("wh-1").await.unwrap(),
                Some(record)
            );
        });
    }

    #[test]
    fn sqlite_archive_repository_reads_records_by_download_target() {
        tauri::async_runtime::block_on(async {
            let temp_dir = tempfile::tempdir().unwrap();
            let database = initialize_for_path(&temp_dir.path().join("wallhaven.sqlite"))
                .await
                .unwrap();
            let repository = database.archive_repository();
            let record = sample_record();

            repository.upsert(record.clone()).await.unwrap();

            assert_eq!(
                repository
                    .find_by_download_target("AppLocalData", None, "wallpapers/wh-1.jpg")
                    .await
                    .unwrap(),
                Some(record)
            );
        });
    }

    #[test]
    fn sqlite_archive_repository_allows_the_same_relative_path_in_different_roots() {
        tauri::async_runtime::block_on(async {
            let temp_dir = tempfile::tempdir().unwrap();
            let database = initialize_for_path(&temp_dir.path().join("wallhaven.sqlite"))
                .await
                .unwrap();
            let repository = database.archive_repository();
            let default_record = ArchiveRecord {
                relative_file_path: "shared.jpg".into(),
                download_base_dir: "AppLocalData".into(),
                ..sample_record()
            };
            let custom_record = ArchiveRecord {
                wallpaper_id: "wh-2".into(),
                source_url: "https://wallhaven.cc/w/wh-2".into(),
                file_name: "shared.jpg".into(),
                relative_file_path: "shared.jpg".into(),
                download_base_dir: "Absolute".into(),
                download_root_path: Some("/Users/test/Pictures/Wallhaven".into()),
            };

            repository.upsert(default_record.clone()).await.unwrap();
            repository.upsert(custom_record.clone()).await.unwrap();

            assert_eq!(
                repository
                    .find_by_download_target("AppLocalData", None, "shared.jpg")
                    .await
                    .unwrap(),
                Some(default_record)
            );
            assert_eq!(
                repository
                    .find_by_download_target(
                        "Absolute",
                        Some("/Users/test/Pictures/Wallhaven"),
                        "shared.jpg"
                    )
                    .await
                    .unwrap(),
                Some(custom_record)
            );
        });
    }

    #[test]
    fn sqlite_archive_repository_rejects_relative_path_conflicts_between_wallpapers() {
        tauri::async_runtime::block_on(async {
            let temp_dir = tempfile::tempdir().unwrap();
            let database = initialize_for_path(&temp_dir.path().join("wallhaven.sqlite"))
                .await
                .unwrap();
            let repository = database.archive_repository();
            let record = sample_record();
            let mut conflicting_record = second_record();
            conflicting_record.relative_file_path = record.relative_file_path.clone();

            repository.upsert(record).await.unwrap();

            assert_eq!(
                repository.upsert(conflicting_record).await.unwrap_err(),
                ArchiveStoreError::RelativeFilePathConflict {
                    relative_file_path: "wallpapers/wh-1.jpg".into(),
                    existing_wallpaper_id: "wh-1".into(),
                    incoming_wallpaper_id: "wh-2".into(),
                }
            );
        });
    }

    #[test]
    fn sqlite_unique_constraint_errors_on_relative_path_map_to_conflicts() {
        tauri::async_runtime::block_on(async {
            let temp_dir = tempfile::tempdir().unwrap();
            let database = initialize_for_path(&temp_dir.path().join("wallhaven.sqlite"))
                .await
                .unwrap();
            let repository = database.archive_repository();
            let record = sample_record();
            let mut conflicting_record = second_record();
            conflicting_record.relative_file_path = record.relative_file_path.clone();

            repository.upsert(record).await.unwrap();

            let error = query(
                "INSERT INTO wallpapers (wallpaper_id, source_url, file_name, relative_file_path, download_base_dir, download_root_path) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(&conflicting_record.wallpaper_id)
            .bind(&conflicting_record.source_url)
            .bind(&conflicting_record.file_name)
            .bind(&conflicting_record.relative_file_path)
            .bind(&conflicting_record.download_base_dir)
            .bind(&conflicting_record.download_root_path)
            .execute(database.pool())
            .await
            .unwrap_err();

            assert_eq!(
                repository
                    .map_upsert_error(error, &conflicting_record)
                    .await,
                ArchiveStoreError::RelativeFilePathConflict {
                    relative_file_path: "wallpapers/wh-1.jpg".into(),
                    existing_wallpaper_id: "wh-1".into(),
                    incoming_wallpaper_id: "wh-2".into(),
                }
            );
        });
    }

    #[test]
    fn sqlite_archive_repository_lists_gallery_records_by_page_and_page_size_in_stable_order() {
        tauri::async_runtime::block_on(async {
            let temp_dir = tempfile::tempdir().unwrap();
            let database = initialize_for_path(&temp_dir.path().join("wallhaven.sqlite"))
                .await
                .unwrap();
            let repository = database.archive_repository();

            for (wallpaper_id, created_at) in [
                ("wh-1", "2026-05-24 08:00:00"),
                ("wh-2", "2026-05-25 10:00:00"),
                ("wh-3", "2026-05-25 10:00:00"),
                ("wh-4", "2026-05-26 09:00:00"),
            ] {
                query(
                    "INSERT INTO wallpapers (wallpaper_id, source_url, file_name, relative_file_path, download_base_dir, download_root_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                )
                .bind(wallpaper_id)
                .bind(format!("https://wallhaven.cc/w/{wallpaper_id}"))
                .bind(format!("{wallpaper_id}.jpg"))
                .bind(format!("wallpapers/{wallpaper_id}.jpg"))
                .bind("AppLocalData")
                .bind::<Option<String>>(None)
                .bind(created_at)
                .execute(database.pool())
                .await
                .unwrap();
            }

            let first_page = repository
                .list_gallery_page(&GalleryListQuery::new(1, 2).unwrap())
                .await
                .unwrap();
            let second_page = repository
                .list_gallery_page(&GalleryListQuery::new(2, 2).unwrap())
                .await
                .unwrap();

            assert_eq!(first_page.total, 4);
            assert_eq!(
                first_page.items,
                vec![
                    GalleryArchiveRecord {
                        wallpaper_id: "wh-4".into(),
                        source_url: "https://wallhaven.cc/w/wh-4".into(),
                        file_name: "wh-4.jpg".into(),
                        relative_file_path: "wallpapers/wh-4.jpg".into(),
                        download_base_dir: "AppLocalData".into(),
                        download_root_path: None,
                        created_at: "2026-05-26 09:00:00".into(),
                    },
                    GalleryArchiveRecord {
                        wallpaper_id: "wh-3".into(),
                        source_url: "https://wallhaven.cc/w/wh-3".into(),
                        file_name: "wh-3.jpg".into(),
                        relative_file_path: "wallpapers/wh-3.jpg".into(),
                        download_base_dir: "AppLocalData".into(),
                        download_root_path: None,
                        created_at: "2026-05-25 10:00:00".into(),
                    },
                ]
            );
            assert_eq!(second_page.total, 4);
            assert_eq!(
                second_page.items,
                vec![
                    GalleryArchiveRecord {
                        wallpaper_id: "wh-2".into(),
                        source_url: "https://wallhaven.cc/w/wh-2".into(),
                        file_name: "wh-2.jpg".into(),
                        relative_file_path: "wallpapers/wh-2.jpg".into(),
                        download_base_dir: "AppLocalData".into(),
                        download_root_path: None,
                        created_at: "2026-05-25 10:00:00".into(),
                    },
                    GalleryArchiveRecord {
                        wallpaper_id: "wh-1".into(),
                        source_url: "https://wallhaven.cc/w/wh-1".into(),
                        file_name: "wh-1.jpg".into(),
                        relative_file_path: "wallpapers/wh-1.jpg".into(),
                        download_base_dir: "AppLocalData".into(),
                        download_root_path: None,
                        created_at: "2026-05-24 08:00:00".into(),
                    },
                ]
            );
        });
    }
}
