export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Falta el URL' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key no configurada' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Visita este URL y extrae la informacion de la noticia. Devuelve SOLO JSON valido sin markdown ni texto extra:
{"headline":"titular completo","description":"resumen de 1-2 oraciones","img":"url de imagen principal o cadena vacia","cat":"politica|tech|deportes|economia|entretenimiento|ciencia|mundial","source":"nombre del medio","time":"hace Xh"}`,
        messages: [{ role: 'user', content: `Extrae la noticia de este link: ${url}` }]
      })
    });

    const data = await r.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json({ ok: true, article: parsed });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Error al extraer' });
  }
}
