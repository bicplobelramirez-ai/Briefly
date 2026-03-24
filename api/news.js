export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const API_KEY = "fa55cfa68f5e46bc9444ae8b81b23153";
  const cats = [
    { newsapi:"technology",   category:"tech"     },
    { newsapi:"business",     category:"economy"  },
    { newsapi:"general",      category:"world"    },
    { newsapi:"sports",       category:"sports"   },
    { newsapi:"science",      category:"science"  },
    { newsapi:"entertainment",category:"business" },
  ];
  const articles = [];
  for (const cat of cats) {
    try {
      const r = await fetch(`https://newsapi.org/v2/top-headlines?category=${cat.newsapi}&language=en&pageSize=4&apiKey=${API_KEY}`);
      const d = await r.json();
      (d.articles||[]).filter(a=>a.title&&a.title!=="[Removed]").slice(0,4).forEach((a,i)=>{
        const diff = Math.floor((Date.now()-new Date(a.publishedAt))/1000);
        const time = diff<3600?`hace ${Math.floor(diff/60)}min`:diff<86400?`hace ${Math.floor(diff/3600)}h`:`hace ${Math.floor(diff/86400)}d`;
        articles.push({ id:`${cat.category}-${i}`, category:cat.category, source:a.source?.name||"News", title:a.title, summary:a.description||"", image:a.urlToImage||null, link:a.url||"#", time, tag:cat.newsapi });
      });
    } catch(e) {}
  }
  res.json(articles);
}
