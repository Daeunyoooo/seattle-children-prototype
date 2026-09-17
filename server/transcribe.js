const GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

const FILE_NAME_BY_MIME = {
  "audio/webm": "speech.webm",
  "audio/mp4": "speech.m4a",
  "audio/ogg": "speech.ogg"
};

function pickFileName(mimeType) {
  const base = String(mimeType || "").split(";")[0].trim().toLowerCase();
  return FILE_NAME_BY_MIME[base] || "speech.webm";
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function transcribeRequest(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    sendJson(res, 503, { ok: false, error: "transcription_not_configured" });
    return;
  }

  try {
    const audioBuffer = await readRawBody(req);
    if (!audioBuffer.length) {
      sendJson(res, 400, { ok: false, error: "empty_audio" });
      return;
    }

    const mimeType = req.headers["x-audio-type"] || "audio/webm";
    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer], { type: mimeType }), pickFileName(mimeType));
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("language", "en");
    formData.append("temperature", "0");
    formData.append("response_format", "json");

    const groqResponse = await fetch(GROQ_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData
    });

    if (!groqResponse.ok) {
      const errorBody = await groqResponse.text().catch(() => "");
      console.error(`Groq transcription failed: ${groqResponse.status} ${errorBody}`);
      sendJson(res, 502, { ok: false, error: "transcription_failed" });
      return;
    }

    const data = await groqResponse.json();
    sendJson(res, 200, { ok: true, text: String(data.text || "").trim() });
  } catch (error) {
    console.error("Transcription error:", error);
    sendJson(res, 500, { ok: false, error: "transcription_failed" });
  }
}
