// SNS Admin Dashboard - Cloudflare Workers API
// API Routes for managing SNS posts

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
      // API Routes
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