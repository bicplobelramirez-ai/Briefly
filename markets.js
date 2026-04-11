export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");

  const symbols = ["GC=F", "CL=F", "SI=F", "BTC-USD", "^GSPC", "EURUSD=X"];
  const keys = ["gold", "oil", "silver", "btc", "sp500", "eur"];

  function fmt(n) {
    if (!n || isNaN(n)) return "--";
    if (n > 10000) return (n / 1000).toFixed(1) + "K";
    if (n > 1000) return n.toFixed(0);
    if (n > 100) return n.toFixed(1);
    return n.toFixed(2);
  }

  try {
    const results = await Promise.all(
      symbols.map(sym =>
        fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`, {
          headers: { "User-Agent": "Mozilla/5.0" }
        })
          .then(r => r.json())
          .catch(() => null)
      )
    );

    const prices = {};
    results.forEach((r, i) => {
      try {
        const meta = r?.chart?.result?.[0]?.meta;
        if (!meta) { prices[keys[i]] = { price: "--", change: "--", up: true }; return; }
        const price = meta.regularMarketPrice;
        const prev = meta.previousClose || meta.chartPreviousClose;
        const pct = prev ? ((price - prev) / prev * 100) : 0;
        prices[keys[i]] = {
          price: fmt(price),
          change: (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%",
          up: pct >= 0
        };
      } catch {
        prices[keys[i]] = { price: "--", change: "--", up: true };
      }
    });

    return res.status(200).json(prices);
  } catch (e) {
    return res.status(200).json({
      gold: { price: "--", change: "--", up: true },
      oil: { price: "--", change: "--", up: false },
      silver: { price: "--", change: "--", up: true },
      btc: { price: "--", change: "--", up: true },
      sp500: { price: "--", change: "--", up: true },
      eur: { price: "--", change: "--", up: false },
    });
  }
}
