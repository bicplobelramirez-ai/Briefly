// Medios dominicanos con RSS feeds
const MEDIOS_RD = [
  { name: "Diario Libre", url: "https://www.diariolibre.com/rss/noticias.xml", cats: ["general","politica","economia"] },
  { name: "Listin Diario", url: "https://listindiario.com/rss", cats: ["general","politica","economia"] },
  { name: "El Caribe", url: "https://www.elcaribe.com.do/feed/", cats: ["general","politica"] },
  { name: "Acento", url: "https://acento.com.do/feed/", cats: ["general","politica","economia"] },
  { name: "N Digital", url: "https://ndigital.do/feed/", cats: ["general","politica"] },
  { name: "CDN", url: "https://cdn.com.do/feed/", cats: ["general","politica"] },
  { name: "El Nuevo Diario", url: "https://www.elnuevodiario.com.do/feed/", cats: ["general","politica"] },
  { name: "Diario Digital", url: "https://diariodigitalrd.com/feed/", cats: ["general","politica"] },
  { name: "Hoy Digital", url: "https://hoy.com.do/feed/", cats: ["general","politica","economia"] },
  { name: "El Nacional", url: "https://elnacional.com.do/feed/", cats: ["general","politica"] },
  { name: "Listin Deportes", url: "https://listindiario.com/deportes/rss", cats: ["deportes"] },
  { name: "Diario Libre Dep", url: "https://www.diariolibre.com/rss/deportes.xml", cats: ["deportes"] },
  { name: "Record RD", url: "https://recordrd.com/feed/", cats: ["deportes"] },
  { name: "Listin Economia", url: "https://listindiario.com/economia/rss", cats: ["economia"] },
  { name: "El Dinero", url: "https://eldinero.com.do/feed/", cats: ["economia"] },
  { name: "Listin Vida", url: "https://listindiario.com/la-vida/rss", cats: ["entretenimiento"] },
  { name: "Listin Tech", url: "https://listindiario.com/tecnologia/rss", cats: ["tech","ciencia"] },
];

const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300");

  const { page = 1, cat, q } = req.query;
  const pageNum = parseInt(page);

  const catMap = {
    politica: "politica", tech: "tech", deportes: "deportes",
    economia: "economia", entretenimiento: "entretenimiento",
    ciencia: "ciencia", mundial: "general",
  };

  const mapped = cat && catMap[cat] ? catMap[cat] : "general";
  const feeds = MEDIOS_RD.filter(f => f.cats.includes(mapped));
  const feedsToUse = feeds.length > 0 ? feeds : MEDIOS_RD.filter(f => f.cats.includes("general"));

  try {
    const results = await Promise.allSettled(
      feedsToUse.map(feed =>
        fetch(`${RSS2JSON}${encodeURIComponent(feed.url)}&count=8`)
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

    if (q) {
      const qL = q.toLowerCase();
      all = all.filter(a =>
        a.title.toLowerCase().includes(qL) ||
        a.description.toLowerCase().includes(qL)
      );
    }

    all.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

    const seen = new Set();
    all = all.filter(a => {
      const key = a.title.substring(0, 50).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    if (all.length === 0) {
      const ndKey = process.env.NEWSDATA_API_KEY;
      if (ndKey) {
        const ndCatMap = { politica:"politics", tech:"technology", deportes:"sports", economia:"business", entretenimiento:"entertainment", ciencia:"science" };
        let ndUrl = `https://newsdata.io/api/1/news?apikey=${ndKey}&country=do&language=es&size=10`;
        if (cat && ndCatMap[cat]) ndUrl += `&category=${ndCatMap[cat]}`;
        const r = await fetch(ndUrl);
        const data = await r.json();
        if (data.status === "success" && data.results?.length) {
          return res.status(200).json({
            country: "do",
            articles: data.results.filter(a => a.title).map((a, i) => ({
              id: `nd-rd-${i}`,
              cat: a.source_id || "RD",
              time: timeAgo(a.pubDate),
              headline: a.title,
              description: a.description || a.title,
              img: a.image_url || "",
              url: a.link || "",
              r: { h: rnd(1,20)+"K", c: rnd(1,8)+"K", s: rnd(1,5)+"K" },
            }))
          });
        }
      }
      return res.status(200).json({ country: "do", articles: [] });
    }

    const perPage = 20;    const paged = all.slice((pageNum - 1) * perPage, pageNum * perPage);

    const articles = paged.map((item, i) => ({
      id: `rd-${pageNum}-${i}`,
      cat: item.source,
      time: timeAgo(item.pubDate),
      headline: item.title,
      description: item.description || item.title,
      img: item.img || "",
      url: item.link,
      r: { h: rnd(1,20)+"K", c: rnd(1,8)+"K", s: rnd(1,5)+"K" },
    }));

    res.status(200).json({ country: "do", articles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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

