export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60");

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    return res.status(200).json(null);
  }

  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/contents/sponsored.json`, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" }
    });

    if (!r.ok) return res.status(200).json(null);

    const data = await r.json();
    const content = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
    return res.status(200).json(content);
  } catch {
    return res.status(200).json(null);
  }
}
