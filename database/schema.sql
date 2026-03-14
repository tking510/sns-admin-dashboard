-- SNS Admin Dashboard - Database Schema
-- Cloudflare D1 (SQLite)

-- 投稿テーブル
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    scheduled_at DATETIME NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed', 'cancelled')),
    platforms TEXT NOT NULL, -- JSON形式: {"telegram": true, "discord": true, ...}
    images TEXT, -- JSON形式: ["url1", "url2", ...]
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    posted_at DATETIME,
    error_message TEXT
);

-- 投稿履歴テーブル（投稿完了後の記録）
CREATE TABLE IF NOT EXISTS post_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    platform TEXT NOT NULL,
    status TEXT NOT NULL, -- success, failed
    external_id TEXT, -- SNS側の投稿ID
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_post_logs_post_id ON post_logs(post_id);

-- サンプルデータ（テスト用）
INSERT INTO posts (content, scheduled_at, status, platforms, images) VALUES
('🎰 今日のスロ天国！最新情報をチェック👆\n\n#スロット天国 #オンラインカジノ', 
 datetime('now', '+1 day', '12:00:00'), 
 'pending', 
 '{"telegram": true, "discord": true, "x": false, "instagram": false, "facebook": false, "threads": false, "youtube": false, "email": false}',
 NULL
);