# SNS Admin Dashboard - スロ天

SNS自動投稿管理システム

## 概要

スロット天国のSNS自動投稿を管理するWebダッシュボードです。
Cloudflareプラットフォームを活用したサーバーレス構成です。

## URL

- **管理画面**: https://sns-admin.slotenpromotion.com
- **API**: https://sns-admin-api.slotenpromotion.com
- **認証**: admin / sloten1234

## 機能

### 投稿管理
- ✅ 投稿作成・編集・削除
- ✅ リッチテキスト編集
- ✅ 画像アップロード（ドラッグ&ドロップ対応）
- ✅ 予約投稿（日時指定）
- ✅ 複数SNS同時投稿

### 対応SNS
- Telegram
- Discord
- X (Twitter)
- Instagram
- Facebook
- Threads
- YouTube
- メール

### 管理機能
- 投稿一覧・フィルタリング
- ステータス管理（予約済み/投稿済み/失敗）
- プレビュー機能
- 自動更新（30秒間隔）

## 技術構成

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Cloudflare     │────▶│  Cloudflare      │────▶│  Cloudflare  │
│  Pages          │     │  Workers         │     │  D1          │
│  (フロントエンド) │     │  (API)           │     │  (SQLite)    │
└─────────────────┘     └──────────────────┘     └──────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  Cloudflare  │
                        │  R2          │
                        │  (画像)      │
                        └──────────────┘
```

## デプロイ方法

```bash
# 1. リポジトリクローン
git clone <repository-url>
cd sns-admin-dashboard

# 2. Cloudflare認証
wrangler login

# 3. デプロイ実行
./deploy.sh
```

## API Endpoints

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | /api/posts | 投稿一覧取得 |
| POST | /api/posts | 新規投稿作成 |
| GET | /api/posts/:id | 投稿詳細取得 |
| PUT | /api/posts/:id | 投稿更新 |
| DELETE | /api/posts/:id | 投稿削除 |
| GET | /api/posts/pending | 未処理投稿取得（n8n用）|

## n8n連携

1. n8nでHTTP Requestノードを設定
2. 5分ごとに `/api/posts/pending` をポーリング
3. 取得した投稿を各SNSに投稿
4. 投稿完了後、ステータスを `posted` に更新

## 開発ロードマップ

### Phase 1 ✅
- [x] 基本構造作成
- [x] CRUD API実装
- [x] フロントエンドUI

### Phase 2 🚧
- [ ] リッチテキストエディタ（TinyMCE）
- [ ] 画像アップロード機能
- [ ] カレンダーUI

### Phase 3 📋
- [ ] プレビュー機能強化
- [ ] 投稿分析レポート
- [ ] テンプレート機能

## 作者

スロット天国 AIチーム