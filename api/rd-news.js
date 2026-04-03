export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300");

  const key = process.env.NEWSDATA_API_KEY;
  const { page = 1, cat, q } = req.query;

  if (!key) return res.status(500).json({ error: "NEWSDATA_API_KEY faltante" });

  // Mapeo de categorías
  const catMap = {
    politica: "politics",
    tech: "technology",
    deportes: "sports",
    economia: "business",
    entretenimiento: "entertainment",
    ciencia: "science",
    mundial: "world",
  };

  try {
    let url = `https://newsdata.io/api/1/news?apikey=${key}&country=do&language=es&size=10`;
    if (cat && catMap[cat]) url += `&category=${catMap[cat]}`;
    if (q) url += `&q=${encodeURIComponent(q)}`;
    if (page > 1) url += `&page=${page}`;

    const r = await fetch(url);
    const data = await r.json();

    if (data.status !== "success" || !data.results?.length) {
      return res.status(200).json({ country: "do", articles: [] });
    }

    const articles = data.results
      .filter(a => a.title && a.description)
      .map((a, i) => ({
        id: `rd-${page}-${i}`,
        cat: a.source_id || "RD",
        time: timeAgo(a.pubDate),
        headline: a.title,
        description: a.description || a.title,
        img: a.image_url || "",
        url: a.link || "",
        memeText: a.title.substring(0, 55) + "... 👀",
        r: { h: rnd(1,20)+"K", c: rnd(1,8)+"K", s: rnd(1,5)+"K" },
        vibes: {
          ELI5: "En palabras simples: " + (a.description || a.title),
          Quick: a.description || a.title,
          Real: "Sin filtro: " + a.title,
          Meme: "Cuando ves que " + a.title.substring(0, 50) + "... 💀",
        }
      }));

    res.status(200).json({ country: "do", articles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function timeAgo(dateStr) {
  if (!dateStr) return "reciente";
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
    if (diff < 60) return `hace ${diff} min`;
    if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
    return `hace ${Math.floor(diff / 1440)}d`;
  } catch { return "reciente"; }
}

function rnd(min, max) {
  return (Math.floor(Math.random() * (max - min + 1)) + min).toFixed(1);
}