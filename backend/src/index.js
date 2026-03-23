// SNS Admin Dashboard - Cloudflare Workers API
// API Routes for managing SNS posts

import { getOverview, getPlatformStats, getEngagementStats, getTimeStats, getLinkStats, updateEngagement } from './analytics.js';
import { shortenLink, redirectLink, getLinkDetail } from './link-tracking.js';
import { getAIRecommendations } from './ai-analysis.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // === 既存ルート ===
      if (path === '/api/posts' && method === 'GET') {
        return await getPosts(env.DB, corsHeaders);
      }
      
      if (path === '/api/posts' && method === 'POST') {
        return await createPost(request, env.DB, corsHeaders);
      }
      
      if (path.match(/^\/api\/posts\/\d+$/) && method === 'GET') {
        const id = path.split('/').pop();
        return await getPost(id, env.DB, corsHeaders);
      }
      
      if (path.match(/^\/api\/posts\/\d+$/) && method === 'PUT') {
        const id = path.split('/').pop();
        return await updatePost(id, request, env.DB, corsHeaders);
      }
      
      if (path.match(/^\/api\/posts\/\d+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        return await deletePost(id, env.DB, corsHeaders);
      }
      
      if (path === '/api/posts/pending' && method === 'GET') {
        return await getPendingPosts(env.DB, corsHeaders);
      }

      // === Analytics Routes ===
      if (path === '/api/analytics/overview' && method === 'GET') {
        return await getOverview(env.DB, corsHeaders);
      }

      if (path === '/api/analytics/platform' && method === 'GET') {
        return await getPlatformStats(env.DB, corsHeaders);
      }

      if (path === '/api/analytics/engagement' && method === 'GET') {
        return await getEngagementStats(env.DB, corsHeaders, url);
      }

      if (path === '/api/analytics/time' && method === 'GET') {
        return await getTimeStats(env.DB, corsHeaders);
      }

      if (path === '/api/analytics/links' && method === 'GET') {
        return await getLinkStats(env.DB, corsHeaders);
      }

      if (path === '/api/analytics/engagement' && method === 'POST') {
        return await updateEngagement(request, env.DB, corsHeaders);
      }

      if (path === '/api/analytics/ai-recommend' && method === 'GET') {
        return await getAIRecommendations(env.DB, env, corsHeaders);
      }

      // === Link Shortening Routes ===
      if (path === '/api/links/shorten' && method === 'POST') {
        return await shortenLink(request, env.DB, corsHeaders);
      }

      if (path.match(/^\/l\/[a-zA-Z0-9]+$/) && method === 'GET') {
        const shortCode = path.replace('/l/', '');
        return await redirectLink(shortCode, request, env.DB);
      }

      if (path.match(/^\/api\/links\/[a-zA-Z0-9]+\/stats$/) && method === 'GET') {
        const shortCode = path.split('/')[3];
        return await getLinkDetail(shortCode, env.DB, corsHeaders);
      }

      // 404 for unknown routes
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// Get all posts
async function getPosts(db, corsHeaders) {
  const { results } = await db.prepare(
    'SELECT * FROM posts ORDER BY scheduled_at DESC'
  ).all();
  
  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Get single post
async function getPost(id, db, corsHeaders) {
  const result = await db.prepare(
    'SELECT * FROM posts WHERE id = ?'
  ).bind(id).first();
  
  if (!result) {
    return new Response(JSON.stringify({ error: 'Post not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Create new post
async function createPost(request, db, corsHeaders) {
  const body = await request.json();
  const { content, scheduled_at, platforms, images } = body;
  
  if (!content || !scheduled_at || !platforms) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const result = await db.prepare(
    `INSERT INTO posts (content, scheduled_at, platforms, images, status) 
     VALUES (?, ?, ?, ?, 'pending')`
  ).bind(content, scheduled_at, JSON.stringify(platforms), images ? JSON.stringify(images) : null).run();
  
  return new Response(JSON.stringify({ 
    id: result.meta.last_row_id,
    message: 'Post created successfully' 
  }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Update post
async function updatePost(id, request, db, corsHeaders) {
  const body = await request.json();
  const { content, scheduled_at, platforms, images, status } = body;
  
  const result = await db.prepare(
    `UPDATE posts 
     SET content = ?, scheduled_at = ?, platforms = ?, images = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    content, 
    scheduled_at, 
    JSON.stringify(platforms), 
    images ? JSON.stringify(images) : null,
    status || 'pending',
    id
  ).run();
  
  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ error: 'Post not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify({ message: 'Post updated successfully' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Delete post
async function deletePost(id, db, corsHeaders) {
  const result = await db.prepare(
    'DELETE FROM posts WHERE id = ?'
  ).bind(id).run();
  
  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ error: 'Post not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify({ message: 'Post deleted successfully' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Get pending posts (for n8n polling)
async function getPendingPosts(db, corsHeaders) {
  const { results } = await db.prepare(
    `SELECT * FROM posts 
     WHERE status = 'pending' 
     AND scheduled_at <= datetime('now')
     ORDER BY scheduled_at ASC`
  ).all();
  
  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}