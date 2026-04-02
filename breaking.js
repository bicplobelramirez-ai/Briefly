export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const body = req.body || {};
  const { password, headline, description, cat } = body;

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "quicknews2024";
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
  const EDGE_CONFIG_ID = process.env.EDGE_CONFIG_ID;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "No autorizado" });
  }

  if (!VERCEL_TOKEN || !EDGE_CONFIG_ID) {
    return res.status(500).json({ error: "Variables de entorno faltantes" });
  }

  const apiUrl = `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/items`;

  try {
    if (req.method === "DELETE") {
      const r = await fetch(apiUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ operation: "delete", key: "breaking_news" }],
        }),
      });
      const d = await r.json();
      return res.status(200).json({ ok: true, action: "deleted", raw: d });
    }

    if (!headline) return res.status(400).json({ error: "headline requerido" });

    const news = {
      id: "breaking-" + Date.now(),
      cat: cat || "🔴 URGENTE",
      time: "ahora mismo",
      headline,
      description: description || headline,
      img: "",
      url: "",
      memeText: headline.substring(0, 55) + "... 🚨",
      r: { h: "0", c: "0", s: "0" },
      breaking: true,
      vibes: {
        ELI5: "URGENTE: " + (description || headline),
        Quick: description || headline,
        Real: "Sin filtro: " + headline,
        Meme: "Cuando ves que " + headline.substring(0, 50) + "... 💀",
      },
    };

    const r = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ operation: "upsert", key: "breaking_news", value: news }],
      }),
    });

    const d = await r.json();
    if (!r.ok) return res.status(500).json({ error: "Error de Vercel API", raw: d });

    res.status(200).json({ ok: true, news });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}