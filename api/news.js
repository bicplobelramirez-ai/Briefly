export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const key = process.env.GNEWS_API_KEY;
  const { q, page = 1, cat, country } = req.query;

  // Detectar país por IP si no se especifica
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

  // 🇩🇴 Si es República Dominicana, usar fuentes locales via RSS
  if (detectedCountry === "do") {
    try {
      const rdRes = await fetch(`${getBaseUrl(req)}/api/rd-news?page=${page}${q ? "&q="+encodeURIComponent(q) : ""}`);
      const rdData = await rdRes.json();
      return res.status(200).json(rdData);
    } catch (e) {
      // Si falla RD, continuar con GNews
    }
  }

  // Para otros países, usar GNews
  const catMap = {
    politica:"nation", tech:"technology", deportes:"sports",
    economia:"business", entretenimiento:"entertainment",
    ciencia:"science", mundial:"world",
  };

  let url;
  if (q) {
    url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=es&country=${detectedCountry}&max=10&page=${page}&apikey=${key}`;
  } else if (cat && catMap[cat]) {
    url = `https://gnews.io/api/v4/top-headlines?topic=${catMap[cat]}&lang=es&country=${detectedCountry}&max=10&page=${page}&apikey=${key}`;
  } else {
    url = `https://gnews.io/api/v4/top-headlines?lang=es&country=${detectedCountry}&max=10&page=${page}&apikey=${key}`;
  }

  try {
    const r = await fetch(url);
    const data = await r.json();

    if (!data.articles || data.articles.length === 0) {
      // Fallback a "any"
      if (detectedCountry !== "any") {
        const fallbackUrl = url.replace(`country=${detectedCountry}`, "country=any");
        const r2 = await fetch(fallbackUrl);
        const data2 = await r2.json();
        if (data2.articles?.length > 0) {
          return res.status(200).json({
            country: detectedCountry,
            fallback: true,
            articles: mapArticles(data2.articles, page)
          });
        }
      }
      return res.status(200).json({ country: detectedCountry, articles: [] });
    }

    res.status(200).json({
      country: detectedCountry,
      articles: mapArticles(data.articles, page)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

function mapArticles(articles, page) {
  return articles
    .filter(a => a.title && a.description)
    .map((a, i) => ({
      id: `${page}-${i}`,
      cat: a.source?.name || "Local",
      time: timeAgo(a.publishedAt),
      headline: a.title,
      description: a.description,
      img: a.image || "",
      url: a.url,
      memeText: a.title.length > 60 ? a.title.substring(0, 55) + "... 👀" : a.title + " 👀",
      r: { h: rnd(5,50)+"K", c: rnd(1,15)+"K", s: rnd(1,8)+"K" },
      vibes: {
        ELI5: `En palabras simples: ${a.description}`,
        Quick: a.description,
        Real: `Sin filtro: ${a.title}. ${a.description}`,
        Meme: `Cuando ves que ${a.title.substring(0,60)}... 💀`,
      }
    }));
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 60) return `hace ${diff} min`;
  if (diff < 1440) return `hace ${Math.floor(diff/60)}h`;
  return `hace ${Math.floor(diff/1440)}d`;
}

function rnd(min, max) {
  return (Math.floor(Math.random() * (max - min + 1)) + min).toFixed(1);
}