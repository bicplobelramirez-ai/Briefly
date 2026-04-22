const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const CHAT_ID = '5866782166';
  const { message } = req.body;
  if (!message || String(message.chat.id) !== CHAT_ID) return res.status(200).end();

  const text = message.text || '';
  const parts = text.split('|').map(p => p.trim());

  if (parts.length < 2) {
    await sendMessage(process.env.TELEGRAM_BOT_TOKEN, 'Formato: titular | descripcion | categoria');
    return res.status(200).json({ ok: true });
  }

  const [headline, description, cat] = parts;
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
  );

  const { error } = await supabase.from('manual_articles').insert([{
    id: 'tg_' + Date.now(),
    headline,
    description: description || '',
    cat: cat || 'mundial',
    time: 'Ahora',
    source: 'QuickNews',
    published_at: new Date().toISOString(),
    active: true
  }]);

  if (error) {
    await sendMessage(process.env.TELEGRAM_BOT_TOKEN, 'Error: ' + error.message);
  } else {
    await sendMessage(process.env.TELEGRAM_BOT_TOKEN, '✅ Publicada en QuickNews!');
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