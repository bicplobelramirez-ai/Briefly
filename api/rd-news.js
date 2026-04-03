const RSS_FEEDS = [
  { name: "Listín Diario",  url: "https://listindiario.com/rss",                 cats: ["politica","economia","mundial"] },
  { name: "Diario Libre",   url: "https://www.diariolibre.com/rss/noticias.xml", cats: ["politica","economia"] },
  { name: "El Caribe",      url: "https://www.elcaribe.com.do/feed/",            cats: ["politica","mundial"] },
  { name: "Acento",         url: "https://acento.com.do/feed/",                  cats: ["politica","economia"] },
  { name: "N Digital",      url: "https://ndigital.do/feed/",                    cats: ["politica","economia"] },
  { name: "CDN",            url: "https://cdn.com.do/feed/",                     cats: ["politica","mundial"] },
  { name: "Listín Dep.",    url: "https://listindiario.com/deportes/rss",        cats: ["deportes"] },
  { name: "Listín Econ.",   url: "https://listindiario.com/economia/rss",        cats: ["economia"] },
  { name: "Listín Tech",    url: "https://listindiario.com/tecnologia/rss",      cats: ["ciencia","tech"] },
];

const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300");

  const { page = 1, cat, q } = req.query;
  const pageNum = parseInt(page);

  try {
    const feeds = cat
      ? RSS_FEEDS.filter(f => f.cats.includes(cat))
      : RSS_FEEDS.filter(f => ["politica","economia","mundial"].some(c => f.cats.includes(c)));

    const feedsToUse = feeds.length > 0 ? feeds : RSS_FEEDS.slice(0, 4);

    // Fetch via rss2json proxy
    const results = await Promise.allSettled(
      feedsToUse.map(feed =>
        fetch(RSS2JSON + encodeURIComponent(feed.url) + "&count=10")
          .then(r => r.json())
          .then(data => {
            if (data.status !== "ok" || !data.items) return [];
            return data.items.map(item => ({
              title: item.title || "",
              link: item.link || "",
              description: stripHtml(item.description || item.content || ""),
              pubDate: item.pubDate || "",
              img: item.thumbnail || item.enclosure?.link || "",
              source: feed.name,
            }));
          })
          .catch(() => [])
      )
    );

    let all = [];
    results.forEach(r => {
      if (r.status === "fulfilled") all = [...all, ...r.value];
    });

    // Filtrar por búsqueda
    if (q) {
      const qL = q.toLowerCase();
      all = all.filter(a =>
        a.title.toLowerCase().includes(qL) ||
        a.description.toLowerCase().includes(qL)
      );
    }

    // Ordenar y deduplicar
    all.sort((a, b) => new Date(b.pubDate||0) - new Date(a.pubDate||0));
    const seen = new Set();
    all = all.filter(a => {
      const key = a.title.substring(0, 40);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    // Paginar
    const perPage = 10;
    const paged = all.slice((pageNum-1)*perPage, pageNum*perPage);

    const articles = paged.map((item, i) => ({
      id: `rd-${pageNum}-${i}`,
      cat: item.source,
      time: timeAgo(item.pubDate),
      headline: item.title,
      description: item.description || item.title,
      img: item.img || "",
      url: item.link,
      memeText: item.title.substring(0, 55) + "... 👀",
      r: { h: rnd(1,20)+"K", c: rnd(1,8)+"K", s: rnd(1,5)+"K" },
      vibes: {
        ELI5: "En palabras simples: " + (item.description || item.title),
        Quick: item.description || item.title,
        Real: "Sin filtro: " + item.title,
        Meme: "Cuando ves que " + item.title.substring(0, 50) + "... 💀",
      }
    }));

    res.status(200).json({ country: "do", articles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 300);
}

function timeAgo(dateStr) {
  if (!dateStr) return "reciente";
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
    if (diff < 60) return `hace ${diff} min`;
    if (diff < 1440) return `hace ${Math.floor(diff/60)}h`;
    return `hace ${Math.floor(diff/1440)}d`;
  } catch { return "reciente"; }
}

function rnd(min, max) {
  return (Math.floor(Math.random() * (max - min + 1)) + min).toFixed(1);
}