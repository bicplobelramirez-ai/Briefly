export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const { lang = "es" } = req.query;

  if (!claudeKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const today = new Date().toLocaleDateString(
    lang === "en" ? "en-US" : "es-ES",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" }
  );

  const system = lang === "en"
    ? `You are a news editor. Today is ${today}. Search the web for current breaking news and return ONLY valid JSON with no markdown, no extra text: {"topics":[{"rank":1,"title":"short topic name","summary":"one sentence what is happening right now","category":"Politics","trend":"up","emoji":"🔥"}]} with exactly 7 trending topics happening RIGHT NOW globally.`
    : `Eres editor de noticias. Hoy es ${today}. Busca en la web las noticias más actuales y devuelve SOLO JSON válido sin markdown ni texto extra: {"topics":[{"rank":1,"title":"nombre corto del tema","summary":"una oración de qué está pasando ahora mismo","category":"Política","trend":"up","emoji":"🔥"}]} con exactamente 7 temas trending AHORA MISMO en el mundo.`;

  const userMsg = lang === "en"
    ? "Search the web and find the top 7 trending news topics right now. Return only JSON."
    : "Busca en la web los 7 temas de noticias más trending ahora mismo. Devuelve solo JSON.";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ "type": "web_search_20250305", "name": "web_search" }],
        system,
        messages: [{ role: "user", content: userMsg }]
      })
    });

    const d = await r.json();

    if (!r.ok) {
      return res.status(500).json({ error: d.error?.message || "Claude API error" });
    }

    const textBlock = d.content?.find(b => b.type === "text");
    if (!textBlock) {
      return res.status(500).json({ error: "No text response from Claude" });
    }

    const raw = textBlock.text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);

    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
}
