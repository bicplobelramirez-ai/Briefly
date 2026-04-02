export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const EDGE_CONFIG_ID = process.env.EDGE_CONFIG_ID;
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

  if (!EDGE_CONFIG_ID || !VERCEL_TOKEN) {
    return res.status(200).json(null);
  }

  try {
    const r = await fetch(
      `https://api.vercel.com/v1/edge-config/${EDGE_CONFIG_ID}/item/breaking_news`,
      {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
        },
      }
    );

    if (!r.ok) return res.status(200).json(null);

    const data = await r.json();
    res.status(200).json(data.value || null);
  } catch (e) {
    res.status(200).json(null);
  }
}