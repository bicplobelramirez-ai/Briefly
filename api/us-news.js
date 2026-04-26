const MEDIOS_US = [
  // Noticias generales en español
  { name: "CNN Español",      url: "https://cnnespanol.cnn.com/feed/",                      cats: ["general","politica","mundial"] },
  { name: "BBC Mundo",        url: "https://feeds.bbci.co.uk/mundo/rss.xml",                cats: ["general","politica","mundial"] },
  { name: "Univision",        url: "https://www.univision.com/rss",                         cats: ["general","politica"] },
  { name: "Telemundo",        url: "https://www.telemundo.com/rss",                         cats: ["general","politica"] },
  { name: "El Diario NY",     url: "https://eldiariony.com/feed/",                          cats: ["general","politica"] },
  { name: "La Opinión",       url: "https://laopinion.com/feed/",                           cats: ["general","politica","economia"] },
  { name: "Mundo Hispánico",  url: "https://mundohispanico.com/feed/",                      cats: ["general","politica"] },
  { name: "Noticias Telemundo",url:"https://www.telemundo.com/noticias/rss",                cats: ["politica","mundial"] },
  // Deportes
  { name: "Marca USA",        url: "https://www.marca.com/rss/portada.xml",                 cats: ["deportes"] },
  { name: "ESPN Deportes",    url: "https://espndeportes.espn.com/rss/noticias",            cats: ["deportes"] },
  // Economía
  { name: "Forbes ES",        url: "https://www.forbes.com.mx/feed/",                       cats: ["economia","tech"] },
  // Tecnología
  { name: "Hipertextual",     url: "https://hipertextual.com/feed",                         cats: ["tech","ciencia"] },
  { name: "Xataka",           url: "https://www.xataka.com/feedburner.xml",                 cats: ["tech","ciencia"] },
  // Grandes medios americanos en español
  { name: "Fox News Latino",  url: "https://feeds.foxnews.com/foxnews/spanish",             cats: ["general","politica","mundial"] },
  { name: "NBC Latino",       url: "https://www.nbcnews.com/feed/noticias",                 cats: ["general","politica"] },
  { name: "ABC Noticias",     url: "https://abcnews.go.com/ABC_Univision/feed",             cats: ["general","politica"] },
  { name: "NYT Español",      url: "https://www.nytimes.com/es/rss/",                       cats: ["general","politica","mundial"] },
  { name: "Washington Post ES",url:"https://www.washingtonpost.com/es/rss/",               cats: ["general","politica","mundial"] },
  { name: "AP Noticias",      url: "https://rsshub.app/apnews/topics/apf-espanol",          cats: ["general","mundial"] },
  { name: "Reuters ES",       url: "https://feeds.reuters.com/reuters/MXTopNews",           cats: ["general","economia","mundial"] },
  { name: "VOA Español",      url: "https://www.voanoticias.com/api/z-mgm_vp-ero",         cats: ["general","politica","mundial"] },
  { name: "NPR Español",      url: "https://feeds.npr.org/1048973/rss.xml",                cats: ["general","politica"] },
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300");

  const { page = 1, cat, q } = req.query;
  const pageNum = parseInt(page);

  const catMap = {
    politica: "politica", tech: "tech", deportes: "deportes",
    economia: "economia", entretenimiento: "entretenimiento",
    ciencia: "ciencia", mundial: "mundial",
  };

  const mapped = cat && catMap[cat] ? catMap[cat] : "general";
  const feeds = MEDIOS_US.filter(f => f.cats.includes(mapped));
  const feedsToUse = feeds.length > 0 ? feeds : MEDIOS_US.filter(f => f.cats.includes("general"));

  try {
    const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";

    const results = await Promise.allSettled(
      feedsToUse.map(feed =>
        fetch(`${RSS2JSON}${encodeURIComponent(feed.url)}&count=8`, {
          signal: AbortSignal.timeout(5000)
        })
        .then(r => r.json())
        .then(data => {
          if (data.status !== "ok" || !data.items?.length) return [];
          return data.items.map(item => ({
            title: cleanText(item.title || ""),
            link: item.link || "",
            description: cleanText(item.description || item.content || ""),
            pubDate: item.pubDate || "",
            img: item.thumbnail || item.enclosure?.link || "",
            source: feed.name,
          })).filter(i => i.title && i.link);
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
    all.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
    const seen = new Set();
    all = all.filter(a => {
      const key = a.title.substring(0, 50).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    // Fallback a NewsData si no hay artículos
    if (all.length === 0) {
      const ndKey = process.env.NEWSDATA_API_KEY;
      if (ndKey) {
        const ndCatMap = { politica:"politics", tech:"technology", deportes:"sports", economia:"business", entretenimiento:"entertainment", ciencia:"science" };
        let ndUrl = `https://newsdata.io/api/1/news?apikey=${ndKey}&country=us&language=es&size=10`;
        if (cat && ndCatMap[cat]) ndUrl += `&category=${ndCatMap[cat]}`;
        const r = await fetch(ndUrl);
        const data = await r.json();
        if (data.status === "success" && data.results?.length) {
          return res.status(200).json({
            country: "us",
            articles: mapNewsData(data.results, pageNum)
          });
        }
      }
      return res.status(200).json({ country: "us", articles: [] });
    }

    // Paginar
    const perPage = 10;
    const paged = all.slice((pageNum - 1) * perPage, pageNum * perPage);

    const articles = paged.map((item, i) => ({
      id: `us-${pageNum}-${i}`,
      cat: item.source,
      time: timeAgo(item.pubDate),
      headline: item.title,
      description: item.description || item.title,
      img: item.img || "",
      url: item.link,
      memeText: item.title.substring(0, 55) + "... 👀",
      r: { h: rnd(5,50)+"K", c: rnd(1,15)+"K", s: rnd(1,8)+"K" },
      vibes: {
        ELI5: "En palabras simples: " + (item.description || item.title),
        Quick: item.description || item.title,
        Real: "Sin filtro: " + item.title,
        Meme: "Cuando ves que " + item.title.substring(0, 50) + "... 💀",
      }
    }));

    res.status(200).json({ country: "us", articles, hasMore: all.length > pageNum * perPage });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function mapNewsData(results, page) {
  return results.filter(a => a.title).map((a, i) => ({
    id: `nd-us-${page}-${i}`,
    cat: a.source_id || "EE.UU.",
    time: timeAgo(a.pubDate),
    headline: a.title,
    description: a.description || a.title,
    img: a.image_url || "",
    url: a.link || "",
    memeText: a.title.substring(0, 55) + "... 👀",
    r: { h: rnd(5,50)+"K", c: rnd(1,15)+"K", s: rnd(1,8)+"K" },
    vibes: {
      ELI5: "En palabras simples: " + (a.description || a.title),
      Quick: a.description || a.title,
      Real: "Sin filtro: " + a.title,
      Meme: "Cuando ves que " + a.title.substring(0, 50) + "... 💀",
    }
  }));
}

function cleanText(str) {
  return str
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim().substring(0, 400);
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