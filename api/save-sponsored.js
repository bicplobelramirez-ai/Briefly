export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const adminPass = process.env.ADMIN_PASSWORD;

  if (!token || !repo) {
    return res.status(500).json({ ok: false, error: "No configurado" });
  }

  if (req.method === "DELETE") {
    try {
      const { password } = req.body;
      if (password !== adminPass) return res.status(401).json({ ok: false, error: "Contraseña incorrecta" });

      const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/sponsored.json`, {
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" }
      });
      if (getRes.ok) {
        const existing = await getRes.json();
        await fetch(`https://api.github.com/repos/${repo}/contents/sponsored.json`, {
          method: "DELETE",
          headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Remove sponsored", sha: existing.sha })
        });
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  if (req.method === "POST") {
    try {
      const { password, brand, title, cta, url, emoji, img } = req.body;

      if (!title) return res.status(400).json({ ok: false, error: "Título requerido" });
      if (password !== adminPass) return res.status(401).json({ ok: false, error: "Contraseña incorrecta" });

      const data = { brand, title, cta, url, emoji, img, updatedAt: new Date().toISOString() };
      const encoded = Buffer.from(JSON.stringify(data)).toString("base64");

      // Verificar si ya existe para obtener el SHA
      let sha = undefined;
      const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/sponsored.json`, {
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" }
      });
      if (getRes.ok) {
        const existing = await getRes.json();
        sha = existing.sha;
      }

      const body = { message: "Update sponsored slot", content: encoded };
      if (sha) body.sha = sha;

      const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/sponsored.json`, {
        method: "PUT",
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json", "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!putRes.ok) {
        const err = await putRes.json();
        return res.status(500).json({ ok: false, error: err.message });
      }

      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
