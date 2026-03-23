// link-tracking.js - Link shortening & tracking handlers

const BASE_URL = 'https://sns-admin-api.slotenpromotion.com';

// ランダムな短縮コード生成
function generateShortCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// POST /api/links/shorten - リンク短縮
export async function shortenLink(request, db, corsHeaders) {
  const body = await request.json();
  const { original_url, post_id, utm_source, utm_medium, utm_campaign } = body;

  if (!original_url) {
    return new Response(JSON.stringify({ error: 'original_url required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // UTMパラメータ自動付与
  let targetUrl = original_url;
  try {
    const urlObj = new URL(original_url);
    if (utm_source) urlObj.searchParams.set('utm_source', utm_source);
    if (utm_medium) urlObj.searchParams.set('utm_medium', utm_medium || 'social');
    if (utm_campaign) urlObj.searchParams.set('utm_campaign', utm_campaign || 'sns-post');
    targetUrl = urlObj.toString();
  } catch (e) {}

  // 短縮コード生成（重複チェック）
  let shortCode;
  let attempts = 0;
  while (attempts < 5) {
    shortCode = generateShortCode();
    const existing = await db.prepare(
      'SELECT id FROM link_tracking WHERE short_code = ?'
    ).bind(shortCode).first();
    if (!existing) break;
    attempts++;
  }

  await db.prepare(`
    INSERT INTO link_tracking (post_id, original_url, short_code, created_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(post_id || null, targetUrl, shortCode).run();

  return new Response(JSON.stringify({
    short_code: shortCode,
    short_url: `${BASE_URL}/l/${shortCode}`,
    original_url: targetUrl,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// GET /l/:shortCode - リダイレクト（クリック計測）
export async function redirectLink(shortCode, request, db) {
  const link = await db.prepare(
    'SELECT * FROM link_tracking WHERE short_code = ?'
  ).bind(shortCode).first();

  if (!link) {
    return new Response('Not found', { status: 404 });
  }

  // クリック数インクリメント
  await db.prepare(
    'UPDATE link_tracking SET clicks = clicks + 1 WHERE short_code = ?'
  ).bind(shortCode).run();

  // クリック詳細ログ
  const referrer = request.headers.get('Referer') || '';
  const userAgent = request.headers.get('User-Agent') || '';
  await db.prepare(`
    INSERT INTO link_clicks (short_code, referrer, user_agent, clicked_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(shortCode, referrer, userAgent).run();

  return Response.redirect(link.original_url, 302);
}

// GET /api/links/:shortCode/stats - 個別リンク統計
export async function getLinkDetail(shortCode, db, corsHeaders) {
  const link = await db.prepare(
    'SELECT * FROM link_tracking WHERE short_code = ?'
  ).bind(shortCode).first();

  if (!link) {
    return new Response(JSON.stringify({ error: 'Link not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { results: clicks } = await db.prepare(`
    SELECT 
      DATE(clicked_at) as date,
      COUNT(*) as count,
      referrer
    FROM link_clicks
    WHERE short_code = ?
    GROUP BY DATE(clicked_at), referrer
    ORDER BY date DESC
  `).bind(shortCode).all();

  return new Response(JSON.stringify({ link, clicks }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
