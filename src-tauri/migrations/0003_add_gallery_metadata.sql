ALTER TABLE wallpapers ADD COLUMN purity TEXT CHECK (purity IN ('sfw', 'sketchy', 'nsfw'));
ALTER TABLE wallpapers ADD COLUMN category TEXT CHECK (category IN ('general', 'anime', 'people'));
ALTER TABLE wallpapers ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE wallpapers ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_wallpapers_purity ON wallpapers (purity);
CREATE INDEX IF NOT EXISTS idx_wallpapers_favorite ON wallpapers (is_favorite);
