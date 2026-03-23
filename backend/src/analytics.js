// analytics.js - Analytics API handlers

// ヘルパー：エラーレスポンス
function errorResponse(message, status = 500, corsHeaders) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// GET /api/analytics/overview - 全体サマリー
export async function getOverview(db, corsHeaders) {
  const totalPosts = await db.prepare('SELECT COUNT(*) as count FROM posts').first();
  const postedPosts = await db.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'posted'").first();
  const failedPosts = await db.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'failed'").first();
  const totalClicks = await db.prepare('SELECT SUM(clicks) as total FROM link_tracking').first();
  const totalEngagement = await db.prepare('SELECT SUM(likes + comments + shares + views) as total FROM post_analytics').first();

  const successRate = totalPosts.count > 0
    ? Math.round((postedPosts.count / totalPosts.count) * 100)
    : 0;

  return new Response(JSON.stringify({
    total_posts: totalPosts.count,
    posted_posts: postedPosts.count,
    failed_posts: failedPosts.count,
    success_rate: successRate,
    total_link_clicks: totalClicks.total || 0,
    total_engagement: totalEngagement.total || 0,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// GET /api/analytics/platform - プラットフォーム別分析
export async function getPlatformStats(db, corsHeaders) {
  const { results } = await db.prepare(`
    SELECT 
      platform,
      COUNT(*) as post_count,
      SUM(likes) as total_likes,
      SUM(comments) as total_comments,
      SUM(shares) as total_shares,
      SUM(views) as total_views,
      SUM(clicks) as total_clicks
    FROM post_analytics
    GROUP BY platform
    ORDER BY post_count DESC
  `).all();

  // 投稿数（postsテーブルのplatformsフィールドから）
  const { results: posts } = await db.prepare(
    "SELECT platforms FROM posts WHERE status = 'posted'"
  ).all();

  const platformCounts = {};
  for (const post of posts) {
    try {
      const platforms = JSON.parse(post.platforms);
      for (const [platform, enabled] of Object.entries(platforms)) {
        if (enabled) {
          platformCounts[platform] = (platformCounts[platform] || 0) + 1;
        }
      }
    } catch (e) {}
  }

  return new Response(JSON.stringify({
    analytics: results,
    post_counts: platformCounts,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// GET /api/analytics/engagement - エンゲージメント分析
export async function getEngagementStats(db, corsHeaders, url) {
  const days = parseInt(url.searchParams.get('days') || '30');

  const { results } = await db.prepare(`
    SELECT 
      DATE(p.scheduled_at) as date,
      SUM(a.likes) as likes,
      SUM(a.comments) as comments,
      SUM(a.shares) as shares,
      SUM(a.views) as views,
      COUNT(DISTINCT p.id) as post_count
    FROM posts p
    LEFT JOIN post_analytics a ON p.id = a.post_id
    WHERE p.scheduled_at >= datetime('now', '-${days} days')
    AND p.status = 'posted'
    GROUP BY DATE(p.scheduled_at)
    ORDER BY date ASC
  `).all();

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// GET /api/analytics/time - 時間帯別効果分析
export async function getTimeStats(db, corsHeaders) {
  const { results } = await db.prepare(`
    SELECT 
      CAST(strftime('%H', p.scheduled_at) AS INTEGER) as hour,
      COUNT(*) as post_count,
      AVG(a.likes + a.comments + a.shares) as avg_engagement,
      SUM(a.clicks) as total_clicks
    FROM posts p
    LEFT JOIN post_analytics a ON p.id = a.post_id
    WHERE p.status = 'posted'
    GROUP BY hour
    ORDER BY hour ASC
  `).all();

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// GET /api/analytics/links - リンク流入分析
export async function getLinkStats(db, corsHeaders) {
  const { results } = await db.prepare(`
    SELECT 
      lt.short_code,
      lt.original_url,
      lt.clicks,
      lt.created_at,
      p.content as post_content,
      p.scheduled_at
    FROM link_tracking lt
    LEFT JOIN posts p ON lt.post_id = p.id
    ORDER BY lt.clicks DESC
    LIMIT 50
  `).all();

  const totalClicks = await db.prepare('SELECT SUM(clicks) as total FROM link_tracking').first();

  return new Response(JSON.stringify({
    links: results,
    total_clicks: totalClicks.total || 0,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// POST /api/analytics/engagement - エンゲージメントデータ更新
export async function updateEngagement(request, db, corsHeaders) {
  const body = await request.json();
  const { post_id, platform, likes, comments, shares, views, clicks } = body;

  if (!post_id || !platform) {
    return errorResponse('post_id and platform required', 400, corsHeaders);
  }

  await db.prepare(`
    INSERT INTO post_analytics (post_id, platform, likes, comments, shares, views, clicks, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(post_id, platform) DO UPDATE SET
      likes = excluded.likes,
      comments = excluded.comments,
      shares = excluded.shares,
      views = excluded.views,
      clicks = excluded.clicks,
      updated_at = CURRENT_TIMESTAMP
  `).bind(post_id, platform, likes || 0, comments || 0, shares || 0, views || 0, clicks || 0).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
