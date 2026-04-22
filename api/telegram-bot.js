export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const CHAT_ID = '5866782166';
  const { message } = req.body;
  if (!message || String(message.chat.id) !== CHAT_ID) return res.status(200).end();

  const text = message.text || '';
  const parts = text.split('|').map(p => p.trim());

  if (parts.length < 2) {
    await sendMessage(req, 'Formato: titular | descripcion | categoria');
    return res.status(200).json({ ok: true });
  }

  const [headline, description, cat] = parts;
  const { createClient } = await import('@supabase/supabase-js');
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
    active: true,
    r: { h: '0', c: '0' }
  }]);

  if (error) {
    await sendMessage(req, 'Error: ' + error.message);
  } else {
    await sendMessage(req, '✅ Publicada en QuickNews!');
  }

  res.status(200).json({ ok: true });
}

async function sendMessage(req, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = '5866782166';
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}