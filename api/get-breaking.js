import { get } from "@vercel/edge-config";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  try {
    const news = await get("breaking_news");
    if (!news) return res.status(200).json(null);
    res.status(200).json(news);
  } catch (e) {
    res.status(200).json(null);
  }
}