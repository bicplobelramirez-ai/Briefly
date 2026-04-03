const RSS_FEEDS = [
  { name: "Listín Diario",  url: "https://listindiario.com/rss" },
  { name: "Diario Libre",   url: "https://www.diariolibre.com/rss/noticias.xml" },
  { name: "El Caribe",      url: "https://www.elcaribe.com.do/feed/" },
  { name: "Acento",         url: "https://acento.com.do/feed/" },
  { name: "El Día",         url: "https://eldia.com.do/feed/" },
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300"); // cache 5 min

  const { page = 1 } = req.query;
  const pageNum = parseInt(page);

  try {
    // Fetch todos los RSS en paralelo
    const results = await Promise.allSettled(
      RSS_FEEDS.map(feed => fetchRSS(feed.url, feed.name))
    );

    // Combinar todos los artículos
    let all = [];
    results.forEach(r => {
      if (r.status === "fulfilled") all = [...all, ...r.value];
    });

    // Ordenar por fecha más reciente
    all.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // Paginar — 10 por página
    const perPage = 10;
    const start = (pageNum - 1) * perPage;
    const paged = all.slice(start, start + perPage);

    const articles = paged.map((item, i) => ({
      id: `rd-${pageNum}-${i}`,
      cat: item.source,
      time: timeAgo(item.pubDate),
      headline: cleanText(item.title),
      description: cleanText(item.description),
      img: item.img || "",
      url: item.link,
      memeText: cleanText(item.title).substring(0, 55) + "... 👀",
      r: { h: rnd(1,20)+"K", c: rnd(1,8)+"K", s: rnd(1,5)+"K" },
      vibes: {
        ELI5: "En palabras simples: " + cleanText(item.description),
        Quick: cleanText(item.description),
        Real: "Sin filtro: " + cleanText(item.title) + ". " + cleanText(item.description),
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
      signal: AbortSignal.timeout(5000),
    });
    const xml = await r.text();
    return parseRSS(xml, sourceName);
  } catch {
    return [];
  }
}

function parseRSS(xml, source) {
  const items = [];
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

  itemMatches.slice(0, 8).forEach(item => {
    const title       = extractTag(item, "title");
    const link        = extractTag(item, "link");
    const description = extractTag(item, "description");
    const pubDate     = extractTag(item, "pubDate");
    const img         = extractImg(item);

    if (title && link) {
      items.push({ title, link, description, pubDate, img, source });
    }
  });

  return items;
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return (m ? (m[1] || m[2] || "") : "").trim();
}

function extractImg(xml) {
  const m = xml.match(/url="([^"]+\.(jpg|jpeg|png|webp))"/i)
    || xml.match(/<media:content[^>]+url="([^"]+)"/i)
    || xml.match(/<enclosure[^>]+url="([^"]+)"/i);
  return m ? m[1] : "";
}

function cleanText(str) {
  if (!str) return "";
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function timeAgo(dateStr) {
  if (!dateStr) return "reciente";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 60) return `hace ${diff} min`;
  if (diff < 1440) return `hace ${Math.floor(diff/60)}h`;
  return `hace ${Math.floor(diff/1440)}d`;
}

function rnd(min, max) {
  return (Math.floor(Math.random() * (max - min + 1)) + min).toFixed(1);
}