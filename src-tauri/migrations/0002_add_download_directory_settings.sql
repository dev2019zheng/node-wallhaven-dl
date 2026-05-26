CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

CREATE TABLE wallpapers_new (
    wallpaper_id TEXT PRIMARY KEY NOT NULL,
    source_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    relative_file_path TEXT NOT NULL,
    download_base_dir TEXT NOT NULL DEFAULT 'AppLocalData' CHECK (download_base_dir IN ('AppLocalData', 'Absolute')),
    download_root_path TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (download_base_dir = 'AppLocalData' AND download_root_path IS NULL)
        OR (
            download_base_dir = 'Absolute'
            AND download_root_path IS NOT NULL
            AND trim(download_root_path) <> ''
        )
    )
);

INSERT INTO wallpapers_new (
    wallpaper_id,
    source_url,
    file_name,
    relative_file_path,
    download_base_dir,
    download_root_path,
    created_at
)
SELECT
    wallpaper_id,
    source_url,
    file_name,
    relative_file_path,
    'AppLocalData',
    NULL,
    created_at
FROM wallpapers;

DROP TABLE wallpapers;
ALTER TABLE wallpapers_new RENAME TO wallpapers;

CREATE UNIQUE INDEX idx_wallpapers_download_target
ON wallpapers (download_base_dir, IFNULL(download_root_path, ''), relative_file_path);

CREATE INDEX idx_wallpapers_created_at
ON wallpapers (created_at DESC, wallpaper_id DESC);
