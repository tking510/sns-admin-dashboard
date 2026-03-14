#!/bin/bash
# SNS Admin Dashboard - Deploy Script

set -e

echo "🚀 SNS Admin Dashboard デプロイ開始"
echo "================================"

# Configuration
ACCOUNT_ID="c2e53413ec2e8bca8b9465f2a2fa26dc"
WORKER_NAME="sns-admin-api"
DB_NAME="sns-admin-db"
BUCKET_NAME="sns-admin-images"
FRONTEND_DOMAIN="sns-admin.slotenpromotion.com"

echo ""
echo "📦 Step 1: D1 Database 作成"
echo "----------------------------"
if ! wrangler d1 list | grep -q "$DB_NAME"; then
    echo "Creating D1 database..."
    wrangler d1 create "$DB_NAME"
else
    echo "D1 database already exists"
fi

echo ""
echo "🗄️  Step 2: Database Schema 適用"
echo "---------------------------------"
wrangler d1 execute "$DB_NAME" --file=./database/schema.sql

echo ""
echo "📁 Step 3: R2 Bucket 作成"
echo "--------------------------"
if ! wrangler r2 bucket list | grep -q "$BUCKET_NAME"; then
    echo "Creating R2 bucket..."
    wrangler r2 bucket create "$BUCKET_NAME"
else
    echo "R2 bucket already exists"
fi

echo ""
echo "⚙️  Step 4: Backend (Workers) デプロイ"
echo "---------------------------------------"
cd backend
# Update wrangler.toml with DB ID
DB_ID=$(wrangler d1 list | grep "$DB_NAME" | awk '{print $1}')
sed -i.bak "s/database_id = \"\"/database_id = \"$DB_ID\"/" wrangler.toml
rm wrangler.toml.bak

# Deploy worker
wrangler deploy

cd ..

echo ""
echo "🌐 Step 5: Frontend (Pages) デプロイ"
echo "-------------------------------------"
# Create pages project
cd frontend

# Create _headers for Basic Auth
cat > _headers << 'HEADERS'
/*
  Basic-Auth: admin:sloten1234
HEADERS

# Deploy to Pages
wrangler pages deploy . --project-name="sns-admin-dashboard" --branch=main

cd ..

echo ""
echo "🔗 Step 6: DNS設定"
echo "------------------"
echo "以下のDNSレコードをCloudflareに追加してください:"
echo ""
echo "Type: CNAME"
echo "Name: sns-admin"
echo "Target: sns-admin-dashboard.pages.dev"
echo "Proxy: Enabled (オレンジクラウド)"
echo ""

echo ""
echo "✅ デプロイ完了！"
echo "=================="
echo "管理画面URL: https://$FRONTEND_DOMAIN"
echo "API URL: https://$WORKER_NAME.slotenpromotion.com"
echo ""
echo "Basic認証:"
echo "  Username: admin"
echo "  Password: sloten1234"
echo ""
echo "📖 使い方:"
echo "1. https://$FRONTEND_DOMAIN にアクセス"
echo "2. Basic認証でログイン"
echo "3. 新規投稿作成 → 投稿先選択 → 予約日時設定 → 保存"
echo "4. n8nが自動的に投稿を処理します"
echo ""

# Cleanup
rm -f frontend/_headers
echo "🎉 完了！"