const PARTICIPANT_SESSION_DRAFT_PREFIX = "seattle-children-participant-draft:";

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

export async function saveParticipantSessionRemote(session) {
  const sessionId = cleanSessionId(session?.sessionId);
  const savedAt = new Date().toISOString();
  const savedSession = {
    ...session,
    sessionId,
    updatedAt: savedAt,
    savedAt
  };

  writeParticipantSessionDraft(savedSession);
  return savedSession;
}

export async function loadParticipantSessionRemote(sessionId) {
  const cleanId = cleanSessionId(sessionId);
  return readParticipantSessionDraft(cleanId);
}

export async function listParticipantSessionsRemote() {
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

export async function uploadSessionAsset() {
  return null;
}

export function isRemoteStorageConfigured() {
  return false;
}

export function getStorageBackendLabel() {
  return "Local browser storage only";
}

export async function rebuildLogDataRemote() {
  return null;
}

export const SESSION_ASSETS_BUCKET = null;
