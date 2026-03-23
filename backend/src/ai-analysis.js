// ai-analysis.js - AI recommendations using Claude API

// GET /api/analytics/ai-recommend
export async function getAIRecommendations(db, env, corsHeaders) {
  // 過去データ収集
  const { results: recentPosts } = await db.prepare(`
    SELECT 
      p.id,
      p.content,
      p.platforms,
      p.scheduled_at,
      p.status,
      COALESCE(SUM(a.likes), 0) as likes,
      COALESCE(SUM(a.comments), 0) as comments,
      COALESCE(SUM(a.shares), 0) as shares,
      COALESCE(SUM(a.clicks), 0) as clicks
    FROM posts p
    LEFT JOIN post_analytics a ON p.id = a.post_id
    WHERE p.status = 'posted'
    GROUP BY p.id
    ORDER BY p.scheduled_at DESC
    LIMIT 50
  `).all();

  const timeStats = await db.prepare(`
    SELECT 
      CAST(strftime('%H', p.scheduled_at) AS INTEGER) as hour,
      COUNT(*) as post_count,
      AVG(a.likes + a.comments + a.shares) as avg_engagement
    FROM posts p
    LEFT JOIN post_analytics a ON p.id = a.post_id
    WHERE p.status = 'posted'
    GROUP BY hour
    ORDER BY avg_engagement DESC
    LIMIT 5
  `).all();

  // キャッシュチェック（過去6時間以内にAI提案があれば再利用）
  const cached = await db.prepare(`
    SELECT recommendation, type, confidence, created_at
    FROM ai_recommendations
    WHERE created_at >= datetime('now', '-6 hours')
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  if (cached.results && cached.results.length > 0) {
    return new Response(JSON.stringify({
      source: 'cache',
      recommendations: cached.results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Claude APIが設定されていない場合はルールベース
  if (!env.CLAUDE_API_KEY) {
    return getRuleBasedRecommendations(timeStats.results || [], db, corsHeaders);
  }

  try {
    const prompt = buildAnalysisPrompt(recentPosts, timeStats.results || []);

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const text = claudeData.content?.[0]?.text || '';

    // JSON解析
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Invalid Claude response');

    const parsed = JSON.parse(jsonMatch[0]);
    const recommendations = [];

    // DB保存＆レスポンス構築
    for (const [type, rec] of Object.entries(parsed)) {
      const recText = typeof rec === 'string' ? rec : JSON.stringify(rec);
      await db.prepare(`
        INSERT INTO ai_recommendations (type, recommendation, confidence, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(type, recText, 0.85).run();

      recommendations.push({ type, recommendation: recText, confidence: 0.85 });
    }

    return new Response(JSON.stringify({
      source: 'claude',
      recommendations,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    // エラー時はルールベースにフォールバック
    return getRuleBasedRecommendations(timeStats.results || [], db, corsHeaders);
  }
}

function buildAnalysisPrompt(posts, timeStats) {
  const topHours = timeStats.slice(0, 3).map(t => `${t.hour}時`).join('、');
  const postCount = posts.length;

  return `あなたはSNSマーケティングの専門家です。以下のSNS投稿データを分析して、最適化提案をJSON形式で返してください。

【データ概要】
- 分析対象投稿数: ${postCount}件
- エンゲージメントが高い時間帯: ${topHours || '不明'}

【投稿サンプル（最新5件）】
${posts.slice(0, 5).map(p => `- 内容: ${p.content?.substring(0, 50)}... | いいね:${p.likes} シェア:${p.shares}`).join('\n')}

以下のJSON形式で回答してください：
{
  "best_time": "最適投稿時間の提案（日本語で簡潔に）",
  "content_tips": "コンテンツ改善提案（日本語で簡潔に）",
  "platform_focus": "注力すべきプラットフォームの提案（日本語で簡潔に）",
  "hashtags": "おすすめハッシュタグ（スペース区切り）"
}`;
}

async function getRuleBasedRecommendations(timeStats, db, corsHeaders) {
  const recommendations = [];

  // 時間帯分析
  const bestHour = timeStats.length > 0 ? timeStats[0].hour : null;
  let timeRec = '投稿時間データが不足しています。まず投稿を増やしてデータを蓄積しましょう。';
  if (bestHour !== null) {
    const period = bestHour < 12 ? '午前' : bestHour < 18 ? '午後' : '夜';
    timeRec = `${period}${bestHour}時台が最もエンゲージメントが高いです。この時間帯への投稿を増やしましょう。`;
  }

  recommendations.push({
    type: 'time',
    recommendation: timeRec,
    confidence: 0.7,
    source: 'rule_based',
  });

  recommendations.push({
    type: 'content',
    recommendation: '画像付き投稿はテキストのみより2〜3倍エンゲージメントが高い傾向があります。画像を積極的に活用しましょう。',
    confidence: 0.75,
    source: 'rule_based',
  });

  recommendations.push({
    type: 'platform',
    recommendation: 'TelegramとDiscordは既存ユーザーとの密なコミュニケーションに、X(Twitter)は新規獲得に有効です。',
    confidence: 0.8,
    source: 'rule_based',
  });

  recommendations.push({
    type: 'hashtags',
    recommendation: '#スロット #オンラインカジノ #スロ天 #ボーナス #フリースピン',
    confidence: 0.65,
    source: 'rule_based',
  });

  return new Response(JSON.stringify({
    source: 'rule_based',
    recommendations,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
