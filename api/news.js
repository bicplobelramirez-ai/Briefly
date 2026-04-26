export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");

  const key = process.env.NEWSDATA_API_KEY;
  const gnewsKey = process.env.GNEWS_API_KEY;
  const { q, page = 1, cat, country } = req.query;

  const validCountries = ["ar","mx","co","cl","pe","ve","ec","bo","py","uy","cu","do","es","br","us","gt","hn","sv","ni","cr","pa"];
  let detectedCountry = country || "any";

  if (!country) {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress;
    try {
      const geoRes = await fetch(`https://ipapi.co/${ip}/country_code/`);
      const code = (await geoRes.text()).toLowerCase().trim();
      if (validCountries.includes(code)) detectedCountry = code;
    } catch {}
  }

  const host = req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${host}`;
  const fromDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().substring(0, 10);

  const catMap = {
    politica: "politics", tech: "technology", deportes: "sports",
    economia: "business", entretenimiento: "entertainment",
    ciencia: "science", mundial: "world",
  };

  if (detectedCountry === "us") {
    try {
      const usRes = await fetch(`${base}/api/us-news?page=${page}${cat?"&cat="+cat:""}${q?"&q="+encodeURIComponent(q):""}`);
      const usData = await usRes.json();
      if (usData.articles?.length > 0) return res.status(200).json(usData);
    } catch {}
  }

  if (detectedCountry === "do") {
    try {
      const rdRes = await fetch(`${base}/api/rd-news?page=${page}${cat?"&cat="+cat:""}${q?"&q="+encodeURIComponent(q):""}`);
      const rdData = await rdRes.json();
      if (rdData.articles?.length > 0) return res.status(200).json(rdData);
    } catch {}
  }

  const [gnewsResult, newsdataResult] = await Promise.allSettled([
    (async () => {
      let url;
      if (q) {
        url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=es&country=any&max=10&from=${fromDate}&sortby=publishedAt&apikey=${gnewsKey}`;
      } else if (cat && catMap[cat]) {
        url = `https://gnews.io/api/v4/top-headlines?topic=${catMap[cat]}&lang=es&country=any&max=10&from=${fromDate}&sortby=publishedAt&apikey=${gnewsKey}`;
      } else {
        url = `https://gnews.io/api/v4/top-headlines?lang=es&country=any&max=10&from=${fromDate}&sortby=publishedAt&apikey=${gnewsKey}`;
      }
      const r = await fetch(url);
      const data = await r.json();
      return data.articles || [];
    })(),
    (async () => {
      if (!key) return [];
      const countryParam = detectedCountry !== "any" ? `&country=${detectedCountry}` : "";
      let url = `https://newsdata.io/api/1/news?apikey=${key}&language=es&size=10${countryParam}&timeframe=6`;
      if (cat && catMap[cat]) url += `&category=${catMap[cat]}`;
      if (q) url += `&q=${encodeURIComponent(q)}`;
      const r = await fetch(url);
      const data = await r.json();
      return data.status === "success" ? (data.results || []) : [];
    })()
  ]);

  const gnewsArticles = gnewsResult.status === "fulfilled" ? gnewsResult.value : [];
  const newsdataArticles = newsdataResult.status === "fulfilled" ? newsdataResult.value : [];

  const mapped = [...mapGNews(gnewsArticles, page), ...mapNewsData(newsdataArticles, page)];

  const seen = new Set();
  const combined = mapped.filter(a => {
    const k = a.headline.substring(0, 50).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const perPage = 20;
  const pageNum = parseInt(page);
  const paged = combined.slice((pageNum - 1) * perPage, pageNum * perPage);
  const hasMore = combined.length > pageNum * perPage;

  if (paged.length > 0) {
    return res.status(200).json({ country: detectedCountry, articles: paged, hasMore, total: combined.length });
  }

  res.status(200).json({ country: detectedCountry, articles: [], hasMore: false });
}

function mapNewsData(results, page) {
  return results.filter(a => a.title).map((a, i) => ({
    id: `nd-${page}-${i}`,
    cat: a.source_id || a.source_name || "Local",
    time: timeAgo(a.pubDate),
    headline: a.title,
    description: a.description || a.title,
    img: a.image_url || "",
    url: a.link || "",
    memeText: a.title.substring(0, 55) + "... 👀",
    r: { h: rnd(1,30)+"K", c: rnd(1,10)+"K", s: rnd(1,6)+"K" },
    vibes: {
      ELI5: "En palabras simples: " + (a.description || a.title),
      Quick: a.description || a.title,
      Real: "Sin filtro: " + a.title,
      Meme: "Cuando ves que " + a.title.substring(0, 50) + "... 💀",
    }
  }));
}

function mapGNews(articles, page) {
  return articles.filter(a => a.title && a.description).map((a, i) => ({
    id: `gn-${page}-${i}`,
    cat: a.source?.name || "Mundial",
    time: timeAgo(a.publishedAt),
    headline: a.title,
    description: a.description,
    img: a.image || "",
    url: a.url,
    memeText: a.title.substring(0, 55) + "... 👀",
    r: { h: rnd(5,50)+"K", c: rnd(1,15)+"K", s: rnd(1,8)+"K" },
    vibes: {
      ELI5: "En palabras simples: " + a.description,
      Quick: a.description,
      Real: "Sin filtro: " + a.title + ". " + a.description,
      Meme: "Cuando ves que " + a.title.substring(0, 60) + "... 💀",
    }
  }));
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