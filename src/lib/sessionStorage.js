const PARTICIPANT_SESSION_DRAFT_PREFIX = "seattle-children-participant-draft:";
const TABLE = "participant_sessions";
export const SESSION_ASSETS_BUCKET = "session-assets";

function cleanSessionId(sessionId) {
  const id = String(sessionId || "").trim();
  if (!/^[a-zA-Z0-9_-]{2,80}$/.test(id)) {
    throw new Error("Invalid or missing participant sessionId");
  }
  return id;
}

function getParticipantSessionDraftKey(sessionId) {
  return `${PARTICIPANT_SESSION_DRAFT_PREFIX}${sessionId}`;
}

function readParticipantSessionDraft(sessionId) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getParticipantSessionDraftKey(sessionId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeParticipantSessionDraft(session) {
  if (typeof window === "undefined" || !session?.sessionId) return;
  window.localStorage.setItem(getParticipantSessionDraftKey(session.sessionId), JSON.stringify(session));
}

function getSupabaseConfig() {
  const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

function supabaseHeaders(anonKey, extra = {}) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function supabaseRequest(path, { method = "GET", body, headers } = {}) {
  const config = getSupabaseConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method,
    headers: supabaseHeaders(config.anonKey, headers),
    body: body == null ? undefined : JSON.stringify(body)
  });

  if (response.status === 204) {
    return { data: null, error: null };
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && (data.message || data.error || data.hint)) ||
      `Supabase request failed (${response.status})`;
    throw new Error(String(message));
  }

  return { data, error: null };
}

function dataUrlToBlob(dataUrl, fallbackType = "image/png") {
  const match = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ""));
  if (!match) return null;
  const mime = match[1] || fallbackType;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function sanitizeStoragePath(path) {
  return String(path || "")
    .replace(/^\/+/, "")
    .replace(/\.\./g, "")
    .replace(/[^a-zA-Z0-9._\-/]/g, "-");
}

export function isRemoteStorageConfigured() {
  return Boolean(getSupabaseConfig());
}

export function getStorageBackendLabel() {
  return isRemoteStorageConfigured() ? "Supabase" : "Local browser storage only";
}

export function getSessionAssetPublicUrl(objectPath) {
  const config = getSupabaseConfig();
  if (!config) return "";
  const cleanPath = sanitizeStoragePath(objectPath);
  return `${config.url}/storage/v1/object/public/${SESSION_ASSETS_BUCKET}/${cleanPath}`;
}

/**
 * Upload a PNG (or other image) to the public session-assets bucket.
 * Returns the public URL, or null when remote storage is not configured.
 */
export async function uploadSessionAsset({ sessionId, path, dataUrl, contentType = "image/png" } = {}) {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cleanId = cleanSessionId(sessionId);
  const relative = sanitizeStoragePath(path);
  if (!relative) throw new Error("Missing storage path");

  const objectPath = `${cleanId}/${relative}`;
  const blob =
    dataUrl instanceof Blob
      ? dataUrl
      : dataUrlToBlob(dataUrl, contentType);
  if (!blob) throw new Error("Invalid image data for storage upload");

  const response = await fetch(
    `${config.url}/storage/v1/object/${SESSION_ASSETS_BUCKET}/${objectPath}`,
    {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": blob.type || contentType,
        "x-upsert": "true"
      },
      body: blob
    }
  );

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.message || errBody?.error || "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Failed to upload session asset (${response.status})`);
  }

  return getSessionAssetPublicUrl(objectPath);
}

export async function saveParticipantSessionRemote(session) {
  const sessionId = cleanSessionId(session?.sessionId);
  const savedAt = new Date().toISOString();
  let savedSession = {
    ...session,
    sessionId,
    updatedAt: savedAt,
    savedAt
  };

  if (isRemoteStorageConfigured()) {
    const { offloadSessionAssets } = await import("./sessionAssets.js");
    savedSession = await offloadSessionAssets(savedSession);
  }

  writeParticipantSessionDraft(savedSession);

  if (isRemoteStorageConfigured()) {
    await supabaseRequest(TABLE, {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: [
        {
          session_id: sessionId,
          payload: savedSession,
          updated_at: savedAt
        }
      ]
    });
  }

  return savedSession;
}

export async function loadParticipantSessionRemote(sessionId) {
  const cleanId = cleanSessionId(sessionId);

  if (isRemoteStorageConfigured()) {
    const { data } = await supabaseRequest(
      `${TABLE}?session_id=eq.${encodeURIComponent(cleanId)}&select=payload`,
      { method: "GET" }
    );
    const payload = Array.isArray(data) ? data[0]?.payload : null;
    if (payload) {
      writeParticipantSessionDraft(payload);
      return payload;
    }
    return null;
  }

  return readParticipantSessionDraft(cleanId);
}

export async function listParticipantSessionsRemote() {
  if (isRemoteStorageConfigured()) {
    const { data } = await supabaseRequest(
      `${TABLE}?select=payload,updated_at&order=updated_at.desc`,
      { method: "GET" }
    );
    return (Array.isArray(data) ? data : []).map((row) => row.payload).filter(Boolean);
  }

  if (typeof window === "undefined") return [];
  return Object.keys(window.localStorage)
    .filter((key) => key.startsWith(PARTICIPANT_SESSION_DRAFT_PREFIX))
    .map((key) => readParticipantSessionDraft(key.slice(PARTICIPANT_SESSION_DRAFT_PREFIX.length)))
    .filter(Boolean)
    .sort((left, right) =>
      String(right.updatedAt || right.savedAt || right.exportedAt || "").localeCompare(
        String(left.updatedAt || left.savedAt || left.exportedAt || "")
      )
    );
}

export async function rebuildLogDataRemote() {
  return null;
}
