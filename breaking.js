import { createClient } from "@vercel/edge-config";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "quicknews2024";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { password, headline, description, cat } = req.body || {};

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const client = createClient(process.env.EDGE_CONFIG);

    if (req.method === "DELETE") {
      await fetch(`https://api.vercel.com/v1/edge-config/${process.env.EDGE_CONFIG_ID}/items`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ operation: "delete", key: "breaking_news" }],
        }),
      });
      return res.status(200).json({ ok: true, action: "deleted" });
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
        ELI5: "URGENTE: " + description || headline,
        Quick: description || headline,
        Real: "Sin filtro: " + headline,
        Meme: "Cuando ves que " + headline.substring(0, 50) + "... 💀",
      },
    };

    await fetch(`https://api.vercel.com/v1/edge-config/${process.env.EDGE_CONFIG_ID}/items`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ operation: "upsert", key: "breaking_news", value: news }],
      }),
    });

    res.status(200).json({ ok: true, news });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}