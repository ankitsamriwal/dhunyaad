// DhunYaad humming identification proxy.
// Holds the ACRCloud credentials server-side (Vercel env vars) so they never
// ship to the client. Browser POSTs { audio_b64, mime }; we sign and forward
// to ACRCloud's identify endpoint and return normalized matches.
import crypto from "node:crypto";

const HOST = process.env.ACRCLOUD_HOST || "identify-ap-southeast-1.acrcloud.com";
const KEY = process.env.ACRCLOUD_ACCESS_KEY || "";
const SECRET = process.env.ACRCLOUD_ACCESS_SECRET || "";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  if (!KEY || !SECRET) {
    res.status(500).json({ error: "not_configured" });
    return;
  }
  try {
    const body = req.body || {};
    const audioB64 = body.audio_b64;
    const mime = typeof body.mime === "string" ? body.mime : "audio/webm";
    if (!audioB64 || typeof audioB64 !== "string") {
      res.status(400).json({ error: "missing_audio" });
      return;
    }
    const buf = Buffer.from(audioB64, "base64");
    if (buf.length < 800) {
      res.status(400).json({ error: "too_short" });
      return;
    }
    if (buf.length > 4000000) {
      res.status(413).json({ error: "too_large" });
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const stringToSign = ["POST", "/v1/identify", KEY, "audio", "1", timestamp].join("\n");
    const signature = crypto.createHmac("sha1", SECRET).update(stringToSign).digest("base64");

    const ext = mime.includes("mp4") ? "m4a" : mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : "wav";
    const form = new FormData();
    form.append("access_key", KEY);
    form.append("data_type", "audio");
    form.append("signature_version", "1");
    form.append("timestamp", timestamp);
    form.append("sample_bytes", String(buf.length));
    form.append("signature", signature);
    form.append("sample", new Blob([buf], { type: mime }), "hum." + ext);

    const upstream = await fetch(`https://${HOST}/v1/identify`, { method: "POST", body: form });
    const data = await upstream.json();
    const status = (data && data.status) || {};
    const raw = (data && data.metadata && (data.metadata.humming || data.metadata.music)) || [];
    const matches = raw.slice(0, 5).map((m) => {
      const scoreNum = Number(m.score || 0);
      const yt = m.external_metadata && m.external_metadata.youtube && m.external_metadata.youtube.vid;
      const sp = m.external_metadata && m.external_metadata.spotify && m.external_metadata.spotify.track;
      return {
        title: m.title || "Unknown",
        artists: (m.artists || []).map((a) => a.name).filter(Boolean),
        album: (m.album && m.album.name) || "",
        score: Math.round(scoreNum <= 1 ? scoreNum * 100 : scoreNum),
        release_date: m.release_date || "",
        acrid: m.acrid || "",
        youtube: yt ? `https://www.youtube.com/watch?v=${yt}` : null,
        spotify: sp && sp.id ? `https://open.spotify.com/track/${sp.id}` : null,
      };
    });
    res.status(200).json({ code: status.code ?? -1, msg: status.msg || "", matches });
  } catch (e) {
    res.status(502).json({ error: "upstream", detail: String(e).slice(0, 200) });
  }
}
