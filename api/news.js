export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const key = process.env.CLAVE_API_DE_NOTICIAS
  const url = `https://newsapi.org/v2/top-headlines?country=us&pageSize=10&apiKey=${key}`;

  try {
    const r = await fetch(url);
    const data = await r.json();

    if (!data.articles) {
      return res.status(500).json({ error: "Sin artículos" });
    }

    const news = data.articles
      .filter(a => a.title && a.description)
      .slice(0, 6)
      .map((a, i) => ({
        id: i + 1,
        cat: a.source?.name || "Mundial",
        time: timeAgo(a.publishedAt),
        headline: a.title,
        description: a.description,
        img: a.urlToImage || "",
        url: a.url,
        memeText: a.title.length > 60
          ? a.title.substring(0, 55) + "... 👀"
          : a.title + " 👀",
        r: { h: rnd(5, 50) + "K", c: rnd(1, 15) + "K", s: rnd(1, 8) + "K" },
        vibes: {
          ELI5: `En palabras simples: ${a.description}`,
          Quick: a.description,
          Real: `Sin filtro: ${a.title}. ${a.description}`,
          Meme: `Cuando ves que ${a.title.substring(0, 60)}... 💀`,
        }
      }));

    res.status(200).json(news);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 60) return `hace ${diff} min`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
  return `hace ${Math.floor(diff / 1440)}d`;
}

function rnd(min, max) {
  return (Math.floor(Math.random() * (max - min + 1)) + min).toFixed(1);
}
