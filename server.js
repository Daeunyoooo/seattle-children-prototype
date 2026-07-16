import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = path.join(__dirname, "src", "data");
const PARTICIPANT_SESSIONS_DIR = path.join(DATA_DIR, "participantSessions");
const LOG_DATA_DIR = path.join(DATA_DIR, "log-data");
const ROLES = ["youth", "caregiver", "clinician"];

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

async function readJson(fileName, fallback) {
  try {
    const text = await fs.readFile(path.join(DATA_DIR, fileName), "utf-8");
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function cleanValues(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean))].slice(
    0,
    6
  );
}

function cleanStakeholder(role, value) {
  return {
    role,
    goal: String(value?.goal || "").trim(),
    values: cleanValues(value?.values)
  };
}

function canonical(value) {
  return String(value).trim().toLowerCase();
}

function safeSessionId(value) {
  const sessionId = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]{2,80}$/.test(sessionId)) return "";
  return sessionId;
}

function overlap(...groups) {
  if (!groups.length) return [];
  const [first, ...rest] = groups.map((group) => group.values || []);
  return first.filter((value) => {
    const key = canonical(value);
    return rest.every((group) => group.some((candidate) => canonical(candidate) === key));
  });
}

function computeSharedValues(stakeholders) {
  return {
    regions: {
      youthCaregiver: overlap(stakeholders.youth, stakeholders.caregiver),
      youthClinician: overlap(stakeholders.youth, stakeholders.clinician),
      caregiverClinician: overlap(stakeholders.caregiver, stakeholders.clinician),
      all: overlap(stakeholders.youth, stakeholders.caregiver, stakeholders.clinician)
    }
  };
}

async function loadStakeholders() {
  const entries = await Promise.all(
    ROLES.map(async (role) => [role, await readJson(`${role}.json`, { role, goal: "", values: [] })])
  );
  const stakeholders = Object.fromEntries(entries);
  const sharedValues = await readJson("sharedValues.json", computeSharedValues(stakeholders));
  return { stakeholders, sharedValues };
}

async function saveStakeholders(payload) {
  const stakeholders = Object.fromEntries(
    ROLES.map((role) => [role, cleanStakeholder(role, payload?.stakeholders?.[role])])
  );
  const sharedValues = computeSharedValues(stakeholders);

  await fs.mkdir(DATA_DIR, { recursive: true });
  await Promise.all([
    ...ROLES.map((role) =>
      fs.writeFile(path.join(DATA_DIR, `${role}.json`), `${JSON.stringify(stakeholders[role], null, 2)}\n`, "utf-8")
    ),
    fs.writeFile(path.join(DATA_DIR, "sharedValues.json"), `${JSON.stringify(sharedValues, null, 2)}\n`, "utf-8")
  ]);

  return { stakeholders, sharedValues };
}

function slugifyValueName(name, fallback = "value") {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || fallback;
}

function dataUrlToBuffer(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ""));
  if (!match) return null;
  return Buffer.from(match[2], "base64");
}

async function writeToolCImage(sessionId, relativePath, dataUrl) {
  const buffer = dataUrlToBuffer(dataUrl);
  if (!buffer) return false;
  const filePath = path.join(LOG_DATA_DIR, sessionId, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
  return true;
}

async function persistToolCToLogData(sessionId, toolC) {
  if (!toolC) return toolC;

  const next = {
    ...toolC,
    perValueDrawings: [],
    composite: {
      ...(toolC.composite || {}),
      legendThumbs: []
    },
    stakeholders: { ...(toolC.stakeholders || {}) }
  };

  next.perValueDrawings = await Promise.all(
    (toolC.perValueDrawings || []).map(async (drawing, index) => {
      if (!drawing?.pngDataUrl) {
        if (drawing?.file) return drawing;
        return null;
      }
      const file = `tool-c/value-${String(index + 1).padStart(2, "0")}-${slugifyValueName(drawing.valueName, `value-${index + 1}`)}.png`;
      await writeToolCImage(sessionId, file, drawing.pngDataUrl);
      return {
        valueName: drawing.valueName || "",
        file,
        pngWidth: drawing.pngWidth ?? null,
        pngHeight: drawing.pngHeight ?? null
      };
    })
  );
  next.perValueDrawings = next.perValueDrawings.filter(Boolean);

  if (toolC.composite?.finalImage?.pngDataUrl) {
    const file = "tool-c/composite.png";
    await writeToolCImage(sessionId, file, toolC.composite.finalImage.pngDataUrl);
    next.composite.finalImage = {
      file,
      pngWidth: toolC.composite.finalImage.pngWidth ?? null,
      pngHeight: toolC.composite.finalImage.pngHeight ?? null
    };
  } else if (toolC.composite?.finalImage?.file) {
    next.composite.finalImage = toolC.composite.finalImage;
  } else {
    next.composite.finalImage = null;
  }

  if (toolC.stakeholders?.finalImage?.pngDataUrl) {
    const file = "tool-c/stakeholders.png";
    await writeToolCImage(sessionId, file, toolC.stakeholders.finalImage.pngDataUrl);
    next.stakeholders.finalImage = {
      file,
      pngWidth: toolC.stakeholders.finalImage.pngWidth ?? null,
      pngHeight: toolC.stakeholders.finalImage.pngHeight ?? null
    };
  } else if (toolC.stakeholders?.finalImage?.file) {
    next.stakeholders.finalImage = toolC.stakeholders.finalImage;
  } else {
    next.stakeholders.finalImage = null;
  }

  return next;
}

async function persistSessionToLogData(session, checkpointName = null) {
  const sessionId = safeSessionId(session?.sessionId);
  if (!sessionId) {
    throw new Error("Invalid or missing participant sessionId");
  }

  const leanSession = {
    ...session,
    sessionId,
    phaseTwo: session.phaseTwo
      ? {
          ...session.phaseTwo,
          toolC: await persistToolCToLogData(sessionId, session.phaseTwo.toolC)
        }
      : session.phaseTwo
  };

  const sessionDir = path.join(LOG_DATA_DIR, sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  await fs.writeFile(
    path.join(sessionDir, "session.json"),
    `${JSON.stringify(leanSession, null, 2)}\n`,
    "utf-8"
  );

  if (checkpointName) {
    await fs.writeFile(
      path.join(sessionDir, `${checkpointName}-log.json`),
      `${JSON.stringify(leanSession, null, 2)}\n`,
      "utf-8"
    );
  }

  return leanSession;
}

async function rebuildLogDataFromStoredSession(sessionIdValue) {
  const sessionId = safeSessionId(sessionIdValue);
  if (!sessionId) {
    throw new Error("Invalid session id");
  }

  const stored = await readJson(path.join("participantSessions", `${sessionId}.json`), null);
  if (!stored) {
    const error = new Error("Participant session not found");
    error.statusCode = 404;
    throw error;
  }

  const leanSession = await persistSessionToLogData(stored);
  await fs.writeFile(
    path.join(PARTICIPANT_SESSIONS_DIR, `${sessionId}.json`),
    `${JSON.stringify({ ...leanSession, savedAt: stored.savedAt || new Date().toISOString() }, null, 2)}\n`,
    "utf-8"
  );

  return { session: leanSession };
}

async function readLogDataFile(sessionIdValue, relativePath) {
  const sessionId = safeSessionId(sessionIdValue);
  if (!sessionId) {
    throw new Error("Invalid session id");
  }
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!normalized || normalized.startsWith("..")) {
    throw new Error("Invalid file path");
  }
  const filePath = path.join(LOG_DATA_DIR, sessionId, normalized);
  return fs.readFile(filePath);
}

async function saveParticipantSession(payload) {
  const session = payload?.session || payload;
  const sessionId = safeSessionId(session?.sessionId);
  if (!sessionId) {
    throw new Error("Invalid or missing participant sessionId");
  }

  const savedAt = new Date().toISOString();
  const checkpointName = payload?.checkpoint || null;
  const leanSession = await persistSessionToLogData(
    {
      ...session,
      sessionId,
      savedAt
    },
    checkpointName
  );
  const savedSession = {
    ...leanSession,
    savedAt
  };

  await fs.mkdir(PARTICIPANT_SESSIONS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(PARTICIPANT_SESSIONS_DIR, `${sessionId}.json`),
    `${JSON.stringify(savedSession, null, 2)}\n`,
    "utf-8"
  );

  return { session: savedSession };
}

async function loadParticipantSession(sessionIdValue) {
  const sessionId = safeSessionId(sessionIdValue);
  if (!sessionId) {
    throw new Error("Invalid or missing participant sessionId");
  }

  const session = await readJson(path.join("participantSessions", `${sessionId}.json`), null);
  if (!session) {
    const error = new Error("Participant session not found");
    error.statusCode = 404;
    throw error;
  }

  return { session };
}

async function listParticipantSessions() {
  await fs.mkdir(PARTICIPANT_SESSIONS_DIR, { recursive: true });
  const entries = await fs.readdir(PARTICIPANT_SESSIONS_DIR);
  const sessions = await Promise.all(
    entries
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const session = await readJson(path.join("participantSessions", name), null);
        if (!session) return null;
        return {
          sessionId: session.sessionId || name.replace(/\.json$/, ""),
          updatedAt: session.updatedAt || session.savedAt || session.exportedAt || null,
          data: session
        };
      })
  );
  return {
    sessions: sessions
      .filter(Boolean)
      .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, service: "seattle-children-prototype" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/stakeholders") {
      sendJson(res, 200, await loadStakeholders());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/stakeholders") {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      sendJson(res, 200, await saveStakeholders(payload));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/participant-sessions") {
      sendJson(res, 200, await listParticipantSessions());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/participant-sessions") {
      const rawBody = await readBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      sendJson(res, 200, await saveParticipantSession(payload));
      return;
    }

    const logDataFileMatch = url.pathname.match(/^\/api\/log-data\/([^/]+)\/(.+)$/);
    if (req.method === "GET" && logDataFileMatch) {
      const sessionId = decodeURIComponent(logDataFileMatch[1]);
      const relativePath = decodeURIComponent(logDataFileMatch[2]);
      const fileBuffer = await readLogDataFile(sessionId, relativePath);
      const ext = path.extname(relativePath).toLowerCase();
      const contentType =
        ext === ".png" ? "image/png" : ext === ".json" ? "application/json; charset=utf-8" : "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(fileBuffer);
      return;
    }

    const logDataRebuildMatch = url.pathname.match(/^\/api\/log-data\/([^/]+)\/rebuild$/);
    if (req.method === "POST" && logDataRebuildMatch) {
      sendJson(res, 200, await rebuildLogDataFromStoredSession(decodeURIComponent(logDataRebuildMatch[1])));
      return;
    }

    const participantSessionMatch = url.pathname.match(/^\/api\/participant-sessions\/([^/]+)$/);
    if (req.method === "GET" && participantSessionMatch) {
      sendJson(res, 200, await loadParticipantSession(decodeURIComponent(participantSessionMatch[1])));
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`JSON API running on http://${HOST}:${PORT}`);
});
