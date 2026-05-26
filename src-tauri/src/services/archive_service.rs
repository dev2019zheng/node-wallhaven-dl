use std::collections::BTreeMap;
use std::error::Error;
use std::fmt;

use crate::models::download::ArchiveRecord;

pub type ArchiveStoreResult<T> = Result<T, ArchiveStoreError>;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ArchiveWriteOutcome {
    Inserted,
    Updated,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ArchiveStoreError {
    Persistence {
        message: String,
    },
    RelativeFilePathConflict {
        relative_file_path: String,
        existing_wallpaper_id: String,
        incoming_wallpaper_id: String,
    },
    InconsistentRelativePathIndex {
        relative_file_path: String,
        wallpaper_id: String,
    },
}

impl fmt::Display for ArchiveStoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Persistence { message } => {
                write!(f, "archive store persistence error: {message}")
            }
            Self::RelativeFilePathConflict {
                relative_file_path,
                existing_wallpaper_id,
                incoming_wallpaper_id,
            } => write!(
                f,
                "relative file path {relative_file_path} is already reserved by wallpaper {existing_wallpaper_id}; cannot assign it to {incoming_wallpaper_id}"
            ),
            Self::InconsistentRelativePathIndex {
                relative_file_path,
                wallpaper_id,
            } => write!(
                f,
                "relative file path index is inconsistent for {relative_file_path}: missing wallpaper {wallpaper_id}"
            ),
        }
    }
}

impl Error for ArchiveStoreError {}

pub trait ArchiveStore {
    fn upsert(&mut self, record: ArchiveRecord) -> ArchiveStoreResult<ArchiveWriteOutcome>;
    fn find_by_wallpaper_id(&self, wallpaper_id: &str)
        -> ArchiveStoreResult<Option<ArchiveRecord>>;
    fn find_by_download_target(
        &self,
        download_base_dir: &str,
        download_root_path: Option<&str>,
        relative_file_path: &str,
    ) -> ArchiveStoreResult<Option<ArchiveRecord>>;
    fn list(&self) -> ArchiveStoreResult<Vec<ArchiveRecord>>;
}

#[derive(Clone, Debug, Default)]
pub struct InMemoryArchiveStore {
    records_by_wallpaper_id: BTreeMap<String, ArchiveRecord>,
    wallpaper_id_by_download_target: BTreeMap<String, String>,
}

impl ArchiveStore for InMemoryArchiveStore {
    fn upsert(&mut self, record: ArchiveRecord) -> ArchiveStoreResult<ArchiveWriteOutcome> {
        let record_key = download_target_key(
            &record.download_base_dir,
            record.download_root_path.as_deref(),
            &record.relative_file_path,
        );

        if let Some(existing_wallpaper_id) = self.wallpaper_id_by_download_target.get(&record_key) {
            if existing_wallpaper_id != &record.wallpaper_id {
                return Err(ArchiveStoreError::RelativeFilePathConflict {
                    relative_file_path: record.relative_file_path.clone(),
                    existing_wallpaper_id: existing_wallpaper_id.clone(),
                    incoming_wallpaper_id: record.wallpaper_id.clone(),
                });
            }
        }

        let previous_record = self
            .records_by_wallpaper_id
            .insert(record.wallpaper_id.clone(), record.clone());

        if let Some(previous_record) = previous_record.as_ref() {
            let previous_key = download_target_key(
                &previous_record.download_base_dir,
                previous_record.download_root_path.as_deref(),
                &previous_record.relative_file_path,
            );
            if previous_key != record_key {
                self.wallpaper_id_by_download_target.remove(&previous_key);
            }
        }

        self.wallpaper_id_by_download_target
            .insert(record_key, record.wallpaper_id.clone());

        Ok(if previous_record.is_some() {
            ArchiveWriteOutcome::Updated
        } else {
            ArchiveWriteOutcome::Inserted
        })
    }

    fn find_by_wallpaper_id(
        &self,
        wallpaper_id: &str,
    ) -> ArchiveStoreResult<Option<ArchiveRecord>> {
        Ok(self.records_by_wallpaper_id.get(wallpaper_id).cloned())
    }

    fn find_by_download_target(
        &self,
        download_base_dir: &str,
        download_root_path: Option<&str>,
        relative_file_path: &str,
    ) -> ArchiveStoreResult<Option<ArchiveRecord>> {
        let key = download_target_key(download_base_dir, download_root_path, relative_file_path);
        let Some(wallpaper_id) = self.wallpaper_id_by_download_target.get(&key) else {
            return Ok(None);
        };

        match self.records_by_wallpaper_id.get(wallpaper_id) {
            Some(record) => Ok(Some(record.clone())),
            None => Err(ArchiveStoreError::InconsistentRelativePathIndex {
                relative_file_path: relative_file_path.to_string(),
                wallpaper_id: wallpaper_id.clone(),
            }),
        }
    }

    fn list(&self) -> ArchiveStoreResult<Vec<ArchiveRecord>> {
        Ok(self.records_by_wallpaper_id.values().cloned().collect())
    }
}

fn download_target_key(
    download_base_dir: &str,
    download_root_path: Option<&str>,
    relative_file_path: &str,
) -> String {
    format!(
        "{}\0{}\0{}",
        download_base_dir,
        download_root_path.unwrap_or_default(),
        relative_file_path,
    )
}

#[cfg(test)]
mod tests {
    use super::{ArchiveStore, ArchiveStoreError, ArchiveWriteOutcome, InMemoryArchiveStore};
    use crate::models::download::ArchiveRecord;

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
    fn archive_store_error_formats_persistence_failures() {
        let error = ArchiveStoreError::Persistence {
            message: "sqlite busy".into(),
        };

        assert_eq!(
            error,
            ArchiveStoreError::Persistence {
                message: "sqlite busy".into(),
            }
        );
        assert_eq!(
            error.to_string(),
            "archive store persistence error: sqlite busy"
        );
    }

    #[test]
    fn in_memory_archive_store_upserts_and_reads_records_by_wallpaper_id() {
        let mut store = InMemoryArchiveStore::default();
        let record = sample_record();

        assert_eq!(
            store.upsert(record.clone()).unwrap(),
            ArchiveWriteOutcome::Inserted
        );
        assert_eq!(store.find_by_wallpaper_id("wh-1").unwrap(), Some(record));
    }

    #[test]
    fn in_memory_archive_store_reads_records_by_download_target() {
        let mut store = InMemoryArchiveStore::default();
        let record = sample_record();

        store.upsert(record.clone()).unwrap();

        assert_eq!(
            store
                .find_by_download_target("AppLocalData", None, "wallpapers/wh-1.jpg")
                .unwrap(),
            Some(record)
        );
    }

    #[test]
    fn in_memory_archive_store_allows_same_relative_path_in_different_roots() {
        let mut store = InMemoryArchiveStore::default();
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

        store.upsert(default_record.clone()).unwrap();
        store.upsert(custom_record.clone()).unwrap();

        assert_eq!(
            store
                .find_by_download_target("AppLocalData", None, "shared.jpg")
                .unwrap(),
            Some(default_record)
        );
        assert_eq!(
            store
                .find_by_download_target(
                    "Absolute",
                    Some("/Users/test/Pictures/Wallhaven"),
                    "shared.jpg"
                )
                .unwrap(),
            Some(custom_record)
        );
    }

    #[test]
    fn in_memory_archive_store_lists_all_records() {
        let mut store = InMemoryArchiveStore::default();
        let record = sample_record();

        store.upsert(record.clone()).unwrap();

        assert_eq!(store.list().unwrap(), vec![record]);
    }

    #[test]
    fn in_memory_archive_store_replaces_records_with_same_wallpaper_id() {
        let mut store = InMemoryArchiveStore::default();
        let record = sample_record();
        let mut updated_record = record.clone();
        updated_record.relative_file_path = "wallpapers/updated/wh-1.jpg".into();

        assert_eq!(
            store.upsert(record.clone()).unwrap(),
            ArchiveWriteOutcome::Inserted
        );
        assert_eq!(
            store.upsert(updated_record.clone()).unwrap(),
            ArchiveWriteOutcome::Updated
        );

        assert_eq!(
            store.find_by_wallpaper_id("wh-1").unwrap(),
            Some(updated_record.clone())
        );
        assert_eq!(
            store
                .find_by_download_target("AppLocalData", None, "wallpapers/wh-1.jpg")
                .unwrap(),
            None
        );
        assert_eq!(
            store
                .find_by_download_target("AppLocalData", None, "wallpapers/updated/wh-1.jpg")
                .unwrap(),
            Some(updated_record)
        );
    }

    #[test]
    fn in_memory_archive_store_rejects_relative_path_conflicts_between_wallpapers() {
        let mut store = InMemoryArchiveStore::default();
        let record = sample_record();
        let mut conflicting_record = second_record();
        conflicting_record.relative_file_path = record.relative_file_path.clone();

        store.upsert(record.clone()).unwrap();

        assert_eq!(
            store.upsert(conflicting_record).unwrap_err(),
            ArchiveStoreError::RelativeFilePathConflict {
                relative_file_path: "wallpapers/wh-1.jpg".into(),
                existing_wallpaper_id: "wh-1".into(),
                incoming_wallpaper_id: "wh-2".into(),
            }
        );
        assert_eq!(
            store
                .find_by_download_target("AppLocalData", None, "wallpapers/wh-1.jpg")
                .unwrap(),
            Some(record)
        );
        assert_eq!(store.find_by_wallpaper_id("wh-2").unwrap(), None);
    }
}
