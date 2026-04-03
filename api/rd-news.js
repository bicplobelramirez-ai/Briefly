const RSS_FEEDS = [
  { name: "Listín Diario",  url: "https://listindiario.com/rss",                    cats: ["politica","economia","mundial"] },
  { name: "Diario Libre",   url: "https://www.diariolibre.com/rss/noticias.xml",    cats: ["politica","economia"] },
  { name: "El Caribe",      url: "https://www.elcaribe.com.do/feed/",               cats: ["politica","mundial"] },
  { name: "Acento",         url: "https://acento.com.do/feed/",                     cats: ["politica","economia"] },
  { name: "El Día", url: "https://www.eldia.do/feed/",                      cats: ["politica"] },
  { name: "Listín Deportes",url: "https://listindiario.com/deportes/rss",           cats: ["deportes"] },
  { name: "Diario Libre Dep",url:"https://www.diariolibre.com/rss/deportes.xml",    cats: ["deportes"] },
  { name: "Listín Entretenimiento", url:"https://listindiario.com/la-vida/rss",     cats: ["entretenimiento"] },
  { name: "Listín Economía",url: "https://listindiario.com/economia/rss",           cats: ["economia"] },
  { name: "Listín Ciencia", url: "https://listindiario.com/tecnologia/rss",         cats: ["ciencia","tech"] },
];
{ name: "N Digital", url: "https://ndigital.do/feed/", cats: ["politica","economia"] },
{ name: "CDN", url: "https://cdn.com.do/feed/", cats: ["politica","mundial"] },
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300");

  const { page = 1, cat, q } = req.query;
  const pageNum = parseInt(page);

  try {
    // Filtrar feeds por categoría si se especifica
    const feeds = cat
      ? RSS_FEEDS.filter(f => f.cats.includes(cat))
      : RSS_FEEDS.filter(f => f.cats.includes("politica") || f.cats.includes("economia") || f.cats.includes("mundial"));

    // Si no hay feeds para esa categoría, usar todos
    const feedsToUse = feeds.length > 0 ? feeds : RSS_FEEDS.slice(0, 5);

    // Fetch en paralelo
    const results = await Promise.allSettled(
      feedsToUse.map(feed => fetchRSS(feed.url, feed.name))
    );

    let all = [];
    results.forEach(r => {
      if (r.status === "fulfilled") all = [...all, ...r.value];
    });

    // Filtrar por búsqueda si hay query
    if (q) {
      const qLower = q.toLowerCase();
      all = all.filter(a =>
        a.title?.toLowerCase().includes(qLower) ||
        a.description?.toLowerCase().includes(qLower)
      );
    }

    // Ordenar por fecha
    all.sort((a, b) => new Date(b.pubDate||0) - new Date(a.pubDate||0));

    // Eliminar duplicados por título similar
    const seen = new Set();
    all = all.filter(a => {
      const key = a.title?.substring(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Paginar
    const perPage = 10;
    const start = (pageNum - 1) * perPage;
    const paged = all.slice(start, start + perPage);

    if (paged.length === 0) {
      return res.status(200).json({ country: "do", articles: [] });
    }

    const articles = paged.map((item, i) => ({
      id: `rd-${pageNum}-${i}-${Date.now()}`,
      cat: item.source,
      time: timeAgo(item.pubDate),
      headline: cleanText(item.title),
      description: cleanText(item.description) || cleanText(item.title),
      img: item.img || "",
      url: item.link,
      memeText: cleanText(item.title).substring(0, 55) + "... 👀",
      r: { h: rnd(1,20)+"K", c: rnd(1,8)+"K", s: rnd(1,5)+"K" },
      vibes: {
        ELI5: "En palabras simples: " + (cleanText(item.description) || cleanText(item.title)),
        Quick: cleanText(item.description) || cleanText(item.title),
        Real: "Sin filtro: " + cleanText(item.title),
        Meme: "Cuando ves que " + cleanText(item.title).substring(0, 50) + "... 💀",
      }
    }));

    res.status(200).json({ country: "do", articles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function fetchRSS(url, sourceName) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 QuickNews/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const xml = await r.text();
    return parseRSS(xml, sourceName);
  } catch {
    return [];
  }
}

function parseRSS(xml, source) {
  const items = [];
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

  itemMatches.slice(0, 15).forEach(item => {
    const title       = extractTag(item, "title");
    const link        = extractTag(item, "link") || extractAttr(item, "link", "href");
    const description = extractTag(item, "description") || extractTag(item, "summary");
    const pubDate     = extractTag(item, "pubDate") || extractTag(item, "published") || extractTag(item, "dc:date");
    const img         = extractImg(item);

    if (title && link) {
      items.push({ title, link, description, pubDate, img, source });
    }
  });

  return items;
}

function extractTag(xml, tag) {
  const patterns = [
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"),
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m && m[1]?.trim()) return m[1].trim();
  }
  return "";
}

function extractAttr(xml, tag, attr) {
  const m = xml.match(new RegExp(`<${tag}[^>]+${attr}="([^"]+)"`, "i"));
  return m ? m[1] : "";
}

function extractImg(xml) {
  const patterns = [
    /url="([^"]+\.(jpg|jpeg|png|webp))"/i,
    /<media:content[^>]+url="([^"]+)"/i,
    /<enclosure[^>]+url="([^"]+)"/i,
    /<media:thumbnail[^>]+url="([^"]+)"/i,
    /src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp))"/i,
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m) return m[1];
  }
  return "";
}

function cleanText(str) {
  if (!str) return "";
  return str
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim().substring(0, 300);
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