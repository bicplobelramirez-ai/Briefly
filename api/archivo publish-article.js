import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, article } = req.body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Contrasena incorrecta' });
  }

  if (!article || !article.headline) {
    return res.status(400).json({ error: 'Falta el titular' });
  }

  try {
    const { error } = await supabase
      .from('manual_articles')
      .insert([{
        id: article.id || 'manual_' + Date.now(),
        headline: article.headline,
        description: article.description || '',
        img: article.img || '',
        url: article.url || '',
        cat: article.cat || 'mundial',
        time: 'Ahora',
        source: article.source || 'QuickNews',
        published_at: new Date().toISOString(),
        active: true
      }]);

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('publish-article error:', err);
    return res.status(500).json({ error: err.message || 'Error al publicar' });
  }
}
