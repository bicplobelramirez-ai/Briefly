module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const CHAT_ID = '5866782166';
  const { message } = req.body;
  if (!message || String(message.chat.id) !== CHAT_ID) return res.status(200).end();

  const text = message.text || '';
  const parts = text.split('|').map(p => p.trim());

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (parts.length < 2) {
    await sendMessage(token, 'Formato: titular | descripcion | categoria');
    return res.status(200).json({ ok: true });
  }

  const [headline, description, cat] = parts;

  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/manual_articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      id: 'tg_' + Date.now(),
      headline,
      description: description || '',
      cat: cat || 'mundial',
      time: 'Ahora',
      source: 'QuickNews',
      published_at: new Date().toISOString(),
      active: true
    })
  });

  if (r.ok) {
    await sendMessage(token, '✅ Publicada en QuickNews!');
  } else {
    const err = await r.text();
    await sendMessage(token, 'Error: ' + err);
  }

  res.status(200).json({ ok: true });
}

async function sendMessage(token, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: '5866782166', text })
  });
}