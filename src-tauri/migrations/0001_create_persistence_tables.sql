CREATE TABLE IF NOT EXISTS wallpapers (
    wallpaper_id TEXT PRIMARY KEY NOT NULL,
    source_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    relative_file_path TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS download_jobs (
    id TEXT PRIMARY KEY NOT NULL,
    wallpaper_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    relative_file_path TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'skipped_existing')),
    failure_reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (status = 'failed' AND failure_reason IS NOT NULL AND trim(failure_reason) <> '')
        OR (status <> 'failed' AND failure_reason IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_download_jobs_wallpaper_id ON download_jobs (wallpaper_id);
CREATE INDEX IF NOT EXISTS idx_download_jobs_status ON download_jobs (status);
