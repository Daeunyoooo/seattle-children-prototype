import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ValueEmojiPicker from "./ValueEmojiPicker.jsx";
import {
  saveParticipantSessionRemote,
  loadParticipantSessionRemote,
  getStorageBackendLabel
} from "./lib/sessionStorage.js";
import {
  PARTICIPANT_EXPORT_SCHEMA_V2,
  buildPhaseTwoExport,
  serializeFinalImage,
  serializePhotoForExport
} from "./lib/sessionExport.js";
import {
  VERSION_B_QUESTION_SEED_LIBRARY,
  VERSION_B_VALUES_SEED_LIBRARY
} from "./assets/image-library/version-b/library.js";
import ToolAVennDiagram from "../Phase2_ToolA_venndiagram/src/App.jsx";
import ToolBPuzzle from "../Phase2_ToolB_Puzzle/src/App.jsx";

const QUESTIONS = [
  {
    num: "Q1",
    text: "Think of a recent favorite memory. It can be something big or really small.",
    hints: ["What happened at that moment?", "Why was it meaningful or important to you?"]
  },
  {
    num: "Q2",
    text: "Please walk me through what a typical day looks like for you.",
    hints: ["Who are the most important people in your life?"]
  },
  {
    num: "Q3",
    text: "What are some of the ways a typical day could be (or become) challenging?",
    hints: ["Do the people you just mentioned help you on those days? How?"]
  },
  {
    num: "Q4",
    text: "What does a perfect day look like to you?",
    hints: ["What do you think a perfect day might look like in the future, when you are a young adult?"]
  },
  {
    num: "Q5",
    text: "What about your future worries you the most?",
    hints: ["How do you think things might be different if you didn't have to worry about that?"]
  },
  {
    num: "Q6",
    text: "Is there anything you wish you could talk more about with your parents or clinicians?",
    hints: []
  }
];

const VERSION_B_QUESTIONS = [
  {
    num: "Q1",
    text: "Tell me a hopeful story about your future."
  },
  {
    num: "Q2",
    text: "Tell me something you worry about in your future."
  }
];

const VERSION_B_VALUE_SLOTS = 4;
/** Default text for the Version B prioritize board (wireframe order; slot 4 is user-fill). */
const VERSION_B_PRIORITIZE_VALUES = [
  "Have a normal life",
  "Have my degree and pursue the work I enjoy",
  "Physical recovery and strength after transplant",
  ""
];
const VERSION_B_BOARD_TEXT_POSITIONS = [
  { x: 8, y: 8 },
  { x: 54, y: 12 },
  { x: 12, y: 48 },
  { x: 52, y: 50 }
];
const VERSION_B_BOARD_QUESTION_PHOTO_POSITIONS = [
  { x: 22, y: 24 },
  { x: 58, y: 28 }
];

function newVersionBCardId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `vb-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampBoardPosition(value, max = 85) {
  return Math.min(max, Math.max(0, value));
}

function createVersionBBoardItemsFromValues(valueTexts) {
  return valueTexts.map((text, index) => ({
    id: newVersionBCardId(),
    type: "text",
    x: VERSION_B_BOARD_TEXT_POSITIONS[index]?.x ?? 16 + (index % 2) * 38,
    y: VERSION_B_BOARD_TEXT_POSITIONS[index]?.y ?? 14 + Math.floor(index / 2) * 36,
    text
  }));
}

function createVersionBBoardImageItemsFromQuestionPhotos(questionPhotos) {
  return questionPhotos
    .map((photo, index) => {
      if (!photo?.url) return null;
      const position = VERSION_B_BOARD_QUESTION_PHOTO_POSITIONS[index] ?? getNextVersionBBoardImagePosition(index);
      return {
        id: newVersionBCardId(),
        type: "image",
        x: position.x,
        y: position.y,
        photo: { name: photo.name, url: photo.url, isUpload: photo.isUpload }
      };
    })
    .filter(Boolean);
}

function getNextVersionBBoardImagePosition(itemCount) {
  return {
    x: clampBoardPosition(24 + (itemCount * 13) % 48),
    y: clampBoardPosition(20 + (itemCount * 17) % 46)
  };
}

const SHAPE_LIST = ["free", "rect", "circle", "triangle", "star"];
const SHAPE_ICONS = { free: "✏️", rect: "■", circle: "●", triangle: "▲", star: "★" };
const COLORS = [
  "#E24B4A",
  "#F2D94E",
  "#EF9F27",
  "#A8D86D",
  "#1D9E75",
  "#76C7E8",
  "#378ADD",
  "#7F77DD",
  "#D4537E",
  "#333333"
];
const STICKER_OPTIONS = ["❤️", "⭐", "🌱", "🎓", "😊", "💪", "🎯", "🌈", "✨", "🦋"];
const INLINE_STICKER_COUNT = 4;
const STAKEHOLDER_COMPONENT_SETS = [
  {
    role: "caregiver",
    label: "Caregiver",
    color: "#D4537E",
    components: [
      {
        label:
          "Life Participation — Being able to do the things you love — school, friends, activities, and everything that makes life meaningful",
        icon: "😊"
      },
      { label: "Survival — Reducing the risk of life-threatening complications", icon: "🙏" },
      {
        label:
          "Preventing Infections — Protecting your body from getting sick, especially from infections that can be serious after a transplant",
        icon: "🛡️"
      }
    ]
  },
  {
    role: "clinician",
    label: "Clinician",
    color: "#1D9E75",
    components: [
      { label: "What matters to you — The things in your life that are most important to you", icon: "💜" },
      { label: "Preventing harm — Keeping you safe from things that could hurt you or make you sicker", icon: "🛡️" },
      { label: "Blood Pressure Control — Keeping your blood pressure at a level that protects your body", icon: "❤️" },
      { label: "Promoting long-term survival — Reducing the risk of life-threatening complications", icon: "🌱" }
    ]
  },
  {
    role: "caregiver-clinician",
    label: "Clinician & Caregiver",
    color: "#6BB9B4",
    components: [{ label: "Kidney Health — Keeping your kidneys as healthy as they can be", icon: "💪" }]
  }
];
const STAKEHOLDER_FINAL_GOALS = [
  {
    role: "caregiver",
    label: "Caregiver",
    color: "#D4537E",
    goal: "Keep my child safe and healthy while supporting their life beyond the condition."
  },
  {
    role: "clinician",
    label: "Clinician",
    color: "#1D9E75",
    goal: "Balance medical safety, adherence, and quality of life in the care plan."
  }
];
const GOAL_PLACEHOLDERS = {
  summary: "",
  action: "",
  progress: "",
  meaning: "",
  timing: ""
};
const GOAL_PROMPTS = [
  { field: "action", icon: "🎯", shortLabel: "What:", label: "what you want to do" },
  { field: "progress", icon: "📏", shortLabel: "How:", label: "how you’ll track progress" },
  { field: "meaning", icon: "💜", shortLabel: "Why:", label: "why it matters to you" },
  { field: "timing", icon: "⏰", shortLabel: "When:", label: "when you hope to achieve it" }
];
const MAX_PHASE2_VALUES = 5;
const RESEARCHER_PATH = "/researcher";
const PARTICIPANT_ACCESS_PASSWORD = "collaboration";
const PARTICIPANT_SESSION_STORAGE_KEY = "seattle-children-participant-id";
const PARTICIPANT_SESSION_DRAFT_PREFIX = "seattle-children-session:";
const PARTICIPANT_SESSION_SYNC_CHANNEL = "seattle-children-session-sync";
const PARTICIPANT_EXPORT_SCHEMA = PARTICIPANT_EXPORT_SCHEMA_V2;
const AI_VALUES_IMPORT_SCHEMA = "seattle-childrens.ai-values.v1";

function createParticipantSessionId() {
  const randomPart =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(16).slice(2, 10);
  return `session-${Date.now().toString(36)}-${randomPart}`;
}

function createInitialParticipantSessionId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PARTICIPANT_SESSION_STORAGE_KEY) || "";
}

function isResearcherPath() {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path === RESEARCHER_PATH || path.endsWith(RESEARCHER_PATH);
}

function getParticipantPath() {
  if (typeof window === "undefined") return "/";
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === RESEARCHER_PATH) return "/";
  if (path.endsWith(RESEARCHER_PATH)) {
    return `${path.slice(0, -RESEARCHER_PATH.length) || "/"}/`;
  }
  return path === "/" ? "/" : `${path}/`;
}

function getResearcherPath() {
  if (typeof window === "undefined") return RESEARCHER_PATH;
  const participantPath = getParticipantPath().replace(/\/+$/, "") || "/";
  return participantPath === "/" ? RESEARCHER_PATH : `${participantPath}${RESEARCHER_PATH}`;
}

function downloadJsonFile(fileName, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getToolCPreviewSrc(sessionId, image) {
  void sessionId;
  if (!image) return "";
  if (image.pngDataUrl) return image.pngDataUrl;
  return "";
}

function photoMetadata(photo) {
  if (!photo) return null;
  const meta = {
    name: photo.name || "",
    source: photo.isUpload ? "participant-upload" : photo.source || "library"
  };
  if (photo.dataUrl) meta.dataUrl = photo.dataUrl;
  if (photo.storageUrl) meta.storageUrl = photo.storageUrl;
  if (photo.url && !photo.url.startsWith("blob:")) meta.url = photo.url;
  return meta;
}

function restorePhotoFromMetadata(photoMeta) {
  if (!photoMeta) return null;
  const url = photoMeta.dataUrl || photoMeta.storageUrl || photoMeta.url || "";
  if (!url) return { name: photoMeta.name || "", isUpload: photoMeta.source === "participant-upload" };
  return {
    name: photoMeta.name || "",
    url,
    dataUrl: photoMeta.dataUrl,
    storageUrl: photoMeta.storageUrl,
    isUpload: photoMeta.source === "participant-upload"
  };
}

function cleanValueText(value) {
  return String(value || "").trim();
}

function getParticipantSessionDraftKey(sessionId) {
  return `${PARTICIPANT_SESSION_DRAFT_PREFIX}${sessionId}`;
}

function readParticipantSessionDraft(sessionId) {
  if (typeof window === "undefined") return null;
  const cleanSessionId = cleanValueText(sessionId);
  if (!cleanSessionId) return null;
  try {
    const raw = window.localStorage.getItem(getParticipantSessionDraftKey(cleanSessionId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeParticipantSessionDraft(session) {
  if (typeof window === "undefined" || !session?.sessionId) return;
  const serialized = JSON.stringify(session);
  window.localStorage.setItem(getParticipantSessionDraftKey(session.sessionId), serialized);
  if ("BroadcastChannel" in window) {
    const channel = new BroadcastChannel(PARTICIPANT_SESSION_SYNC_CHANNEL);
    channel.postMessage({ session });
    channel.close();
  }
}

function pickNewerDraft(localDraft, remoteDraft) {
  if (!localDraft) return remoteDraft;
  if (!remoteDraft) return localDraft;
  const localTime = Date.parse(localDraft.updatedAt || localDraft.savedAt || localDraft.exportedAt || 0);
  const remoteTime = Date.parse(remoteDraft.updatedAt || remoteDraft.savedAt || remoteDraft.exportedAt || 0);
  return remoteTime >= localTime ? remoteDraft : localDraft;
}

async function resolveParticipantDraft(sessionId) {
  const cleanSessionId = cleanValueText(sessionId);
  if (!cleanSessionId) return null;
  const localDraft = readParticipantSessionDraft(cleanSessionId);
  let remoteDraft = null;
  try {
    remoteDraft = await loadParticipantSessionRemote(cleanSessionId);
  } catch {
    // Remote draft may not exist yet.
  }
  const merged = pickNewerDraft(localDraft, remoteDraft);
  if (merged) writeParticipantSessionDraft(merged);
  return merged;
}

function normalizeAiValue(value, index) {
  const text = typeof value === "string" ? value : value?.text || value?.label || value?.value;
  const cleanText = cleanValueText(text);
  if (!cleanText) return null;
  return {
    id: value?.id || `ai-${Date.now()}-${index}`,
    text: cleanText,
    icon: value?.icon || getValueIcon(cleanText),
    rationale: cleanValueText(value?.rationale || value?.reason || ""),
    confidence: value?.confidence ?? null,
    source: "AI"
  };
}

function normalizeAiValuesPayload(payload) {
  const candidateValues = payload?.values || payload?.aiValues || payload?.suggestedValues;
  if (!Array.isArray(candidateValues)) {
    throw new Error("AI values JSON must include a values array.");
  }
  const values = candidateValues.map(normalizeAiValue).filter(Boolean).slice(0, 10);
  if (values.length === 0) {
    throw new Error("AI values JSON did not include any usable value text.");
  }
  return {
    schema: payload?.schema || AI_VALUES_IMPORT_SCHEMA,
    sessionId: cleanValueText(payload?.sessionId || payload?.participantSessionId),
    generatedAt: payload?.generatedAt || new Date().toISOString(),
    values
  };
}

function createPhaseOneToolOrder() {
  return Math.random() < 0.5 ? ["A", "B"] : ["B", "A"];
}

function getValueIcon(value) {
  const text = value.toLowerCase();
  if (/(physical|recovery|strength|transplant|health|healthy)/.test(text)) return "💪";
  if (/(degree|school|work|career|study)/.test(text)) return "🎓";
  if (/(happy|happiness|joy)/.test(text)) return "😊";
  if (/(normal|life|grow|routine)/.test(text)) return "🌱";
  if (/(people|family|friend|around|support)/.test(text)) return "❤️";
  if (/(future|goal|achieve)/.test(text)) return "🎯";
  return "⭐";
}

function drawShapeCtx(ctx, shape, cx, cy, radius) {
  ctx.beginPath();
  if (shape === "rect") {
    ctx.rect(cx - radius, cy - radius, radius * 2, radius * 2);
  } else if (shape === "circle") {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  } else if (shape === "triangle") {
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx + radius * 0.866, cy + radius * 0.5);
    ctx.lineTo(cx - radius * 0.866, cy + radius * 0.5);
    ctx.closePath();
  } else if (shape === "star") {
    for (let point = 0; point < 5; point += 1) {
      const angle = (point * 4 * Math.PI) / 5 - Math.PI / 2;
      const innerAngle = angle + (2 * Math.PI) / 10;
      const innerRadius = radius * 0.45;
      if (point === 0) ctx.moveTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
      else ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
      ctx.lineTo(cx + innerRadius * Math.cos(innerAngle), cy + innerRadius * Math.sin(innerAngle));
    }
    ctx.closePath();
  }
  ctx.fill();
}

function drawStickerCtx(ctx, sticker, x, y, size = 36, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.font = `${size}px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(sticker, 0, 0);
  ctx.restore();
}

function getStickerHandles(sticker) {
  const half = sticker.size / 2;
  const cos = Math.cos(sticker.rotation || 0);
  const sin = Math.sin(sticker.rotation || 0);
  const rotatePoint = (localX, localY) => ({
    x: sticker.x + cos * localX - sin * localY,
    y: sticker.y + sin * localX + cos * localY
  });
  return {
    resize: rotatePoint(half, half),
    rotate: rotatePoint(0, -half - 24),
    delete: rotatePoint(-half, -half)
  };
}

function stickerWorldToLocal(sticker, worldX, worldY) {
  const dx = worldX - sticker.x;
  const dy = worldY - sticker.y;
  const cos = Math.cos(-(sticker.rotation || 0));
  const sin = Math.sin(-(sticker.rotation || 0));
  return { x: cos * dx - sin * dy, y: sin * dx + cos * dy };
}

function hitSticker(sticker, worldX, worldY) {
  const local = stickerWorldToLocal(sticker, worldX, worldY);
  const half = sticker.size / 2;
  return Math.abs(local.x) <= half + 8 && Math.abs(local.y) <= half + 8;
}

function hitStickerHandle(sticker, worldX, worldY) {
  const handles = getStickerHandles(sticker);
  if (Math.hypot(worldX - handles.resize.x, worldY - handles.resize.y) < 12) return "resize";
  if (Math.hypot(worldX - handles.rotate.x, worldY - handles.rotate.y) < 12) return "rotate";
  if (Math.hypot(worldX - handles.delete.x, worldY - handles.delete.y) < 12) return "delete";
  return null;
}

function getShapeBounds(shape) {
  return {
    x: shape.cx - shape.r,
    y: shape.cy - shape.r,
    w: shape.r * 2,
    h: shape.r * 2
  };
}

function getShapeHandles(shape) {
  const bounds = getShapeBounds(shape);
  return {
    resize: { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
    rotate: { x: shape.cx, y: bounds.y - 24 },
    delete: { x: bounds.x, y: bounds.y }
  };
}

function hitShapeHandle(shape, worldX, worldY) {
  const handles = getShapeHandles(shape);
  if (Math.hypot(worldX - handles.resize.x, worldY - handles.resize.y) < 12) return "resize-shape";
  if (Math.hypot(worldX - handles.rotate.x, worldY - handles.rotate.y) < 12) return "rotate-shape";
  if (Math.hypot(worldX - handles.delete.x, worldY - handles.delete.y) < 12) return "delete-shape";
  return null;
}

function hitShape(shape, worldX, worldY) {
  const rotation = shape.rotation || 0;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const dx = worldX - shape.cx;
  const dy = worldY - shape.cy;
  const localX = cos * dx - sin * dy + shape.cx;
  const localY = sin * dx + cos * dy + shape.cy;
  if (shape.type === "circle") return Math.hypot(localX - shape.cx, localY - shape.cy) <= shape.r + 8;
  const bounds = getShapeBounds(shape);
  return (
    localX >= bounds.x - 8 &&
    localX <= bounds.x + bounds.w + 8 &&
    localY >= bounds.y - 8 &&
    localY <= bounds.y + bounds.h + 8
  );
}

function getStrokeBounds(stroke) {
  const xs = stroke.pts.map((point) => point.x);
  const ys = stroke.pts.map((point) => point.y);
  const pad = (stroke.w || 1) / 2 + 8;
  return {
    x: Math.min(...xs) - pad,
    y: Math.min(...ys) - pad,
    w: Math.max(...xs) - Math.min(...xs) + pad * 2,
    h: Math.max(...ys) - Math.min(...ys) + pad * 2
  };
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function hitStroke(stroke, worldX, worldY) {
  if (stroke.pts.length === 1) {
    return Math.hypot(worldX - stroke.pts[0].x, worldY - stroke.pts[0].y) <= (stroke.w || 1) / 2 + 8;
  }
  const point = { x: worldX, y: worldY };
  return stroke.pts.some((candidate, index) => {
    if (index === 0) return false;
    return distanceToSegment(point, stroke.pts[index - 1], candidate) <= (stroke.w || 1) / 2 + 8;
  });
}

function drawObjectSelection(ctx, bounds) {
  ctx.save();
  ctx.strokeStyle = "#378ADD";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawShapeSelection(ctx, shape) {
  const bounds = getShapeBounds(shape);
  const handles = getShapeHandles(shape);
  drawObjectSelection(ctx, bounds);
  ctx.save();
  ctx.strokeStyle = "#378ADD";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(shape.cx, bounds.y);
  ctx.lineTo(handles.rotate.x, handles.rotate.y);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#378ADD";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(handles.resize.x - 6, handles.resize.y - 6, 12, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#378ADD";
  ctx.beginPath();
  ctx.arc(handles.rotate.x, handles.rotate.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("↻", handles.rotate.x, handles.rotate.y);
  ctx.fillStyle = "#E24B4A";
  ctx.beginPath();
  ctx.arc(handles.delete.x, handles.delete.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("×", handles.delete.x, handles.delete.y);
  ctx.restore();
}

function getPoint(canvas, event, useTouch = false) {
  const rect = canvas.getBoundingClientRect();
  const source = useTouch ? event.touches[0] || event.changedTouches[0] : event;
  return {
    x: (source.clientX - rect.left) * (canvas.width / rect.width),
    y: (source.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function drawStoredCanvas(canvasState) {
  if (!canvasState?.ctx) return;
  const { cv, ctx, strokes, shapes, stickers = [] } = canvasState;
  ctx.clearRect(0, 0, cv.width, cv.height);
  strokes.forEach((stroke) => {
    if (stroke.pts.length < 2) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.pts[0].x, stroke.pts[0].y);
    stroke.pts.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  });
  shapes.forEach((shape) => {
    ctx.save();
    ctx.translate(shape.cx, shape.cy);
    ctx.rotate(shape.rotation || 0);
    ctx.translate(-shape.cx, -shape.cy);
    ctx.fillStyle = shape.color;
    drawShapeCtx(ctx, shape.type, shape.cx, shape.cy, shape.r);
    ctx.restore();
  });
  stickers.forEach((sticker) => {
    drawStickerCtx(ctx, sticker.emoji, sticker.x, sticker.y, sticker.size, sticker.rotation || 0);
  });

  if (canvasState.selectedObject?.type === "shape") {
    const selectedShape = shapes[canvasState.selectedObject.index];
    if (selectedShape) drawShapeSelection(ctx, selectedShape);
  } else if (canvasState.selectedObject?.type === "stroke") {
    const selectedStroke = strokes[canvasState.selectedObject.index];
    if (selectedStroke?.pts?.length) drawObjectSelection(ctx, getStrokeBounds(selectedStroke));
  }

  const selectedSticker = Number.isInteger(canvasState.selectedStickerIndex)
    ? stickers[canvasState.selectedStickerIndex]
    : null;
  if (!selectedSticker) return;

  const half = selectedSticker.size / 2;
  const handles = getStickerHandles(selectedSticker);
  ctx.save();
  ctx.translate(selectedSticker.x, selectedSticker.y);
  ctx.rotate(selectedSticker.rotation || 0);
  ctx.strokeStyle = "#378ADD";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(-half - 4, -half - 4, selectedSticker.size + 8, selectedSticker.size + 8);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(0, -half);
  ctx.lineTo(0, -half - 24);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#378ADD";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(handles.resize.x - 6, handles.resize.y - 6, 12, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#378ADD";
  ctx.beginPath();
  ctx.arc(handles.rotate.x, handles.rotate.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("↻", handles.rotate.x, handles.rotate.y);
  ctx.fillStyle = "#E24B4A";
  ctx.beginPath();
  ctx.arc(handles.delete.x, handles.delete.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("×", handles.delete.x, handles.delete.y);
}

function getContentBounds(sourceCanvas) {
  const ctx = sourceCanvas.getContext("2d");
  const { width, height } = sourceCanvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width;
  let y0 = height;
  let x1 = 0;
  let y1 = 0;
  let found = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        found = true;
      }
    }
  }

  if (!found) return null;
  const padding = 8;
  return {
    x: Math.max(0, x0 - padding),
    y: Math.max(0, y0 - padding),
    w: Math.min(width, x1 + padding + 1) - Math.max(0, x0 - padding),
    h: Math.min(height, y1 + padding + 1) - Math.max(0, y0 - padding)
  };
}

function exportCroppedPNG(canvasState) {
  if (!canvasState?.cv) return null;
  const full = document.createElement("canvas");
  full.width = canvasState.cv.width;
  full.height = canvasState.cv.height;
  const ctx = full.getContext("2d");

  canvasState.strokes.forEach((stroke) => {
    if (stroke.pts.length < 2) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.pts[0].x, stroke.pts[0].y);
    stroke.pts.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  });
  canvasState.shapes.forEach((shape) => {
    ctx.save();
    ctx.translate(shape.cx, shape.cy);
    ctx.rotate(shape.rotation || 0);
    ctx.translate(-shape.cx, -shape.cy);
    ctx.fillStyle = shape.color;
    drawShapeCtx(ctx, shape.type, shape.cx, shape.cy, shape.r);
    ctx.restore();
  });
  (canvasState.stickers || []).forEach((sticker) => {
    drawStickerCtx(ctx, sticker.emoji, sticker.x, sticker.y, sticker.size, sticker.rotation || 0);
  });

  const bounds = getContentBounds(full);
  if (!bounds) return null;

  const out = document.createElement("canvas");
  out.width = bounds.w;
  out.height = bounds.h;
  out.getContext("2d").drawImage(full, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
  return { dataURL: out.toDataURL("image/png"), w: bounds.w, h: bounds.h };
}

function paintCompositeBackground(ctx, width = 400, height = 340) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f7f5ef";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.13)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 300);
  ctx.lineTo(370, 50);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(200, 170, 120, 0, Math.PI * 1.1);
  ctx.stroke();
  ctx.strokeStyle = "rgba(180,0,0,0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(35, 215);
  ctx.lineTo(105, 215);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 250);
  ctx.lineTo(100, 250);
  ctx.stroke();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.arc(305, 272, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintCompositeItems(ctx, items) {
  (items || []).forEach((item) => {
    const { w, h } = getItemBounds(item);
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);
    if (item.placeholder) {
      ctx.fillStyle = COLORS[item.valueIdx % COLORS.length];
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (item.img) {
      ctx.drawImage(item.img, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  });
}

function paintOverlayStrokes(ctx, strokes) {
  (strokes || []).forEach((stroke) => {
    if (stroke.pts.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.pts[0].x, stroke.pts[0].y);
    stroke.pts.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.stroke();
    ctx.restore();
  });
}

function exportCompositeFinalPNG(items, strokes) {
  const width = 400;
  const height = 340;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  paintCompositeBackground(ctx, width, height);
  paintCompositeItems(ctx, items);
  paintOverlayStrokes(ctx, strokes);
  return { dataURL: canvas.toDataURL("image/png"), w: width, h: height };
}

function loadImageForExport(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function exportStakeholderBoardPNG(placedComponents, strokes, width = 560, height = 360) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f7f5ef";
  ctx.fillRect(0, 0, width, height);

  for (const component of placedComponents || []) {
    if (!component.src) continue;
    try {
      const img = await loadImageForExport(component.src);
      const size = 96 * (component.scale || 1);
      ctx.save();
      ctx.translate(component.x, component.y);
      ctx.rotate(((component.rotation || 0) * Math.PI) / 180);
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    } catch {
      // Skip images that fail to load.
    }
  }

  paintOverlayStrokes(ctx, strokes);
  return { dataURL: canvas.toDataURL("image/png"), w: width, h: height };
}

function getItemBounds(item) {
  const w = item.natW * item.scale;
  const h = item.natH * item.scale;
  return { w, h, hw: w / 2, hh: h / 2 };
}

function worldToLocal(item, worldX, worldY) {
  const dx = worldX - item.x;
  const dy = worldY - item.y;
  const cos = Math.cos(-item.rotation);
  const sin = Math.sin(-item.rotation);
  return { x: cos * dx - sin * dy, y: sin * dx + cos * dy };
}

function hitItem(item, worldX, worldY) {
  const local = worldToLocal(item, worldX, worldY);
  const { hw, hh } = getItemBounds(item);
  return Math.abs(local.x) <= hw + 8 && Math.abs(local.y) <= hh + 8;
}

function getHandles(item) {
  const { hw, hh } = getItemBounds(item);
  const cos = Math.cos(item.rotation);
  const sin = Math.sin(item.rotation);
  const rotatePoint = (localX, localY) => ({
    x: item.x + cos * localX - sin * localY,
    y: item.y + sin * localX + cos * localY
  });
  return {
    resize: rotatePoint(hw, hh),
    rotate: rotatePoint(0, -hh - 24),
    delete: rotatePoint(-hw, -hh)
  };
}

function hitHandle(item, worldX, worldY) {
  const handles = getHandles(item);
  if (Math.hypot(worldX - handles.resize.x, worldY - handles.resize.y) < 12) return "resize";
  if (Math.hypot(worldX - handles.rotate.x, worldY - handles.rotate.y) < 12) return "rotate";
  if (Math.hypot(worldX - handles.delete.x, worldY - handles.delete.y) < 12) return "delete";
  return null;
}

function getCompositePoint(canvas, event, useTouch = false) {
  const rect = canvas.getBoundingClientRect();
  const source = useTouch ? event.touches[0] || event.changedTouches[0] : event;
  return {
    x: (source.clientX - rect.left) * (400 / rect.width),
    y: (source.clientY - rect.top) * (340 / rect.height)
  };
}

function makeDefaultSettings(length) {
  return Array.from({ length }, () => ({ tool: "free", colorIndex: 0, brushSize: 12, sticker: STICKER_OPTIONS[0] }));
}

function getCompositeItemPosition(index, total) {
  const columns = total <= 2 ? Math.max(1, total) : total === 4 ? 2 : 3;
  const rows = Math.ceil(total / columns);
  const col = index % columns;
  const row = Math.floor(index / columns);
  return {
    x: ((col + 0.5) * 400) / columns,
    y: rows === 1 ? 150 : 85 + row * (170 / Math.max(1, rows - 1))
  };
}

function makeMockComponentPNG(component, color, index) {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 240;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 12;

  if (component.icon) {
    ctx.font = "58px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(component.icon, 60, 60);
  } else if (component.shape === "circle") {
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(60, 56, 30, 0, Math.PI * 2);
    ctx.fill();
  } else if (component.shape === "line") {
    ctx.beginPath();
    ctx.moveTo(20, 76);
    ctx.bezierCurveTo(42, 24, 74, 98, 100, 40);
    ctx.stroke();
  } else if (component.shape === "heart") {
    ctx.beginPath();
    ctx.moveTo(60, 94);
    ctx.bezierCurveTo(16, 62, 24, 24, 54, 36);
    ctx.bezierCurveTo(70, 12, 112, 34, 60, 94);
    ctx.fill();
  } else if (component.shape === "arc") {
    ctx.beginPath();
    ctx.arc(60, 68, 36, Math.PI * 0.95, Math.PI * 2.1);
    ctx.stroke();
  } else if (component.shape === "square") {
    ctx.globalAlpha = 0.78;
    ctx.translate(60, 60);
    ctx.rotate(Math.PI / 8);
    ctx.fillRect(-28, -28, 56, 56);
  } else if (component.shape === "star") {
    drawShapeCtx(ctx, "star", 60, 58, 34);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!component.icon) {
    ctx.scale(2, 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(33,31,28,0.72)";
    ctx.font = "600 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`value ${index + 1}`, 60, 112);
  }
  return { dataURL: canvas.toDataURL("image/png"), w: 120, h: 120 };
}

function releaseUploadedPhoto(photo) {
  if (photo?.isUpload && photo?.url) URL.revokeObjectURL(photo.url);
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  let line = "";
  const lines = [];

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });
  if (line) lines.push(line);

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((lineText, index) => {
    ctx.fillText(lineText, x, startY + index * lineHeight);
  });
}

function makeAiGeneratedImage(prompt) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, "#7f77dd");
  gradient.addColorStop(1, "#378add");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.beginPath();
  ctx.arc(256, 168, 92, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  wrapCanvasText(ctx, prompt, 256, 286, 380, 28);

  ctx.font = "500 13px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  ctx.fillText("AI generated", 256, 452);

  return canvas.toDataURL("image/png");
}

function createAiLibraryItem(prompt) {
  const trimmed = prompt.trim();
  return {
    id: `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: `AI: ${trimmed.slice(0, 40)}${trimmed.length > 40 ? "…" : ""}`,
    url: makeAiGeneratedImage(trimmed),
    source: "ai"
  };
}

function ImageLibrary({
  items,
  onAdd,
  onSelect,
  onGenerateAi,
  activeUrl,
  emptyHint,
  aiPlaceholder,
  description,
  showAiGenerate = true
}) {
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiOpen, setAiOpen] = useState(false);

  function handleGenerateAi() {
    const prompt = aiPrompt.trim();
    if (!prompt) return;
    onGenerateAi(prompt);
    setAiPrompt("");
    setAiOpen(false);
  }

  return (
    <div className="image-library">
      <div className="image-library-header">
        <span className="image-library-title">Image library</span>
        <span className="image-library-hint">Tap a photo to use it</span>
      </div>
      {description ? <p className="image-library-description">{description}</p> : null}
      <div className="image-library-grid" role="list">
        <label className="image-library-add" aria-label="Add photo to library">
          <input
            type="file"
            accept="image/*"
            className="image-library-add-input"
            onChange={(event) => {
              onAdd(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <span className="image-library-add-icon" aria-hidden="true">
            +
          </span>
        </label>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`image-library-item ${activeUrl === item.url ? "is-selected" : ""}`}
            onClick={() => onSelect(item)}
            aria-label={`Use ${item.name}`}
            aria-pressed={activeUrl === item.url}
          >
            <img src={item.url} alt="" />
          </button>
        ))}
        {showAiGenerate ? (
          <div className="image-library-ai-wrap">
            <button
              type="button"
              className={`image-library-ai-tile ${aiOpen ? "is-open" : ""}`}
              aria-label="Generate with AI"
              aria-expanded={aiOpen}
              onClick={() => setAiOpen((open) => !open)}
            >
              <span className="image-library-ai-icon" aria-hidden="true">
                ✨
              </span>
              <span className="image-library-ai-label">Generate with AI</span>
            </button>
            {aiOpen ? (
              <div className="image-library-ai-popover">
                <button
                  type="button"
                  className="image-library-ai-close"
                  aria-label="Close"
                  onClick={() => setAiOpen(false)}
                >
                  ×
                </button>
                <textarea
                  className="image-library-ai-input"
                  rows={2}
                  placeholder={aiPlaceholder}
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                />
                <button
                  className="image-library-ai-generate"
                  type="button"
                  disabled={!aiPrompt.trim()}
                  onClick={handleGenerateAi}
                >
                  Generate with AI
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {items.length === 0 ? <p className="image-library-empty">{emptyHint}</p> : null}
      </div>
    </div>
  );
}

export default function App() {
  const initialPhaseOneSessionRef = useRef(null);
  if (!initialPhaseOneSessionRef.current) {
    const order = createPhaseOneToolOrder();
    initialPhaseOneSessionRef.current = { order, firstTool: order[0] };
  }

  const researcherMode = isResearcherPath();
  const [participantSessionId, setParticipantSessionId] = useState(() => createInitialParticipantSessionId());
  const [participantPassword, setParticipantPassword] = useState("");
  const [participantPasswordError, setParticipantPasswordError] = useState("");
  const [participantIntroComplete, setParticipantIntroComplete] = useState(false);
  const [researcherSessionLookup, setResearcherSessionLookup] = useState(() => createInitialParticipantSessionId());
  const [researcherStatus, setResearcherStatus] = useState("");
  const [researcherJsonPaste, setResearcherJsonPaste] = useState("");
  const [researcherExportTool, setResearcherExportTool] = useState("A");
  const [researcherImportTool, setResearcherImportTool] = useState("A");
  const [sessionSaved, setSessionSaved] = useState(false);
  const [sessionSaveStatus, setSessionSaveStatus] = useState("");
  const [participantFinished, setParticipantFinished] = useState(false);
  const [researcherDraftTick, setResearcherDraftTick] = useState(0);
  const [participantSyncStatus, setParticipantSyncStatus] = useState("");
  const [aiSuggestedValues, setAiSuggestedValues] = useState([]);
  const [newAiValue, setNewAiValue] = useState("");
  const [phase, setPhase] = useState(1);
  const [phaseOneToolOrder] = useState(() => initialPhaseOneSessionRef.current.order);
  const [phaseOneVersion, setPhaseOneVersion] = useState(() => initialPhaseOneSessionRef.current.firstTool);
  const [completedPhaseOneTools, setCompletedPhaseOneTools] = useState([]);
  const [phaseOneScreen, setPhaseOneScreen] = useState("questions");
  const [phaseOneToolProgress, setPhaseOneToolProgress] = useState(() => ({
    A: { screen: "questions", questionIndex: 0 },
    B: { screen: "questions", questionIndex: 0 }
  }));
  const [phaseTwoScreen, setPhaseTwoScreen] = useState("shapes");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState(() => Array(QUESTIONS.length).fill(""));
  const [versionBAnswers, setVersionBAnswers] = useState(() => Array(VERSION_B_QUESTIONS.length).fill(""));
  const [versionBPhotos, setVersionBPhotos] = useState(() => Array(VERSION_B_QUESTIONS.length).fill(null));
  const [versionBQuestionIndex, setVersionBQuestionIndex] = useState(0);
  const [versionBBoardItems, setVersionBBoardItems] = useState(() => []);
  const [versionBSelectedBoardItemId, setVersionBSelectedBoardItemId] = useState(null);
  const versionBBoardRef = useRef(null);
  const versionBBoardDragRef = useRef(null);
  const [versionBGoalShort, setVersionBGoalShort] = useState("");
  const [versionBGoalLong, setVersionBGoalLong] = useState("");
  const [versionBQuestionLibrary, setVersionBQuestionLibrary] = useState(() => [...VERSION_B_QUESTION_SEED_LIBRARY]);
  const [versionBValuesLibrary, setVersionBValuesLibrary] = useState(() => [...VERSION_B_VALUES_SEED_LIBRARY]);
  const [versionBPhotoPanel, setVersionBPhotoPanel] = useState(null);
  const [versionBDrawSettings, setVersionBDrawSettings] = useState(() =>
    VERSION_B_QUESTIONS.map(() => ({ tool: "free", colorIndex: 0, brushSize: 12, sticker: STICKER_OPTIONS[0] }))
  );
  const [versionBDrawEmojiPickerIndex, setVersionBDrawEmojiPickerIndex] = useState(null);
  const [values, setValues] = useState([]);
  const [valueIcons, setValueIcons] = useState([]);
  const [toolAValues, setToolAValues] = useState([]);
  const [toolAValueIcons, setToolAValueIcons] = useState([]);
  const [toolAGoalData, setToolAGoalData] = useState(() => ({ ...GOAL_PLACEHOLDERS }));
  const [toolBValues, setToolBValues] = useState([]);
  const [toolBValueIcons, setToolBValueIcons] = useState([]);
  const [phase2SelectedGoalSources, setPhase2SelectedGoalSources] = useState(["A", "B"]);
  const [phase2SelectedValues, setPhase2SelectedValues] = useState([]);
  const phase2SelectedValuesRef = useRef(phase2SelectedValues);
  const [newValue, setNewValue] = useState("");
  const [emojiPickerIndex, setEmojiPickerIndex] = useState(null);
  const [summaryEmojiPickerKey, setSummaryEmojiPickerKey] = useState(null);
  const [drawEmojiPickerIndex, setDrawEmojiPickerIndex] = useState(null);
  const [goalData, setGoalData] = useState(() => ({ ...GOAL_PLACEHOLDERS }));
  const [editingGoal, setEditingGoal] = useState(null);
  const [showGoalExample, setShowGoalExample] = useState(false);
  const [pictureTitle, setPictureTitle] = useState("");
  const [drawValues, setDrawValues] = useState([]);
  const [drawSettings, setDrawSettings] = useState(() => makeDefaultSettings(0));
  const [legendThumbs, setLegendThumbs] = useState([]);
  const [componentTray, setComponentTray] = useState([]);
  const [placedComponents, setPlacedComponents] = useState([]);
  const [selectedPlacedId, setSelectedPlacedId] = useState(null);
  const [compositeDrawTool, setCompositeDrawTool] = useState("brush");
  const [compositeBrushColorIndex, setCompositeBrushColorIndex] = useState(6);
  const [compositeBrushSize, setCompositeBrushSize] = useState(7);
  const [sharedDrawTool, setSharedDrawTool] = useState("select");
  const [sharedBrushColorIndex, setSharedBrushColorIndex] = useState(6);
  const [sharedBrushSize, setSharedBrushSize] = useState(8);
  const [shareTargets, setShareTargets] = useState({ caregiver: true, clinician: true });
  const [listeningQuestion, setListeningQuestion] = useState(null);
  const [speechDraft, setSpeechDraft] = useState("");
  const [, forceCompositeDraw] = useState(0);
  const [, forceSharedDraw] = useState(0);

  const drawCanvasRefs = useRef([]);
  const canvasStatesRef = useRef([]);
  const drawStartsRef = useRef([]);
  const drawInteractRef = useRef(null);
  const versionBDrawCanvasRefs = useRef([]);
  const versionBCanvasStatesRef = useRef([]);
  const versionBDrawStartsRef = useRef([]);
  const versionBDrawInteractRef = useRef(null);
  const versionBUploadInputRef = useRef(null);
  const compositeCanvasRef = useRef(null);
  const compositeItemsRef = useRef([]);
  const compositeDrawCanvasRef = useRef(null);
  const compositeStrokesRef = useRef([]);
  const compositeActiveStrokeRef = useRef(null);
  const sharedCanvasRef = useRef(null);
  const sharedStrokesRef = useRef([]);
  const sharedActiveStrokeRef = useRef(null);
  const perValueDrawingImagesRef = useRef([]);
  const initialParticipantSessionIdRef = useRef(participantSessionId);
  const participantDraftRestoredRef = useRef(false);
  const selectedIdxRef = useRef(null);
  const interactModeRef = useRef(null);
  const interactStartRef = useRef({});
  const dragPayloadRef = useRef(null);
  const valueResizeRef = useRef(null);
  const recognitionRef = useRef(null);
  const sessionEventsRef = useRef([]);

  function appendSessionEvent(event) {
    sessionEventsRef.current = [
      ...sessionEventsRef.current.slice(-499),
      { at: new Date().toISOString(), ...event }
    ];
  }

  useEffect(() => {
    if (phase !== 1 || phaseOneScreen === "summary") return;
    setPhaseOneToolProgress((current) => ({
      ...current,
      [phaseOneVersion]: {
        screen: phaseOneScreen,
        questionIndex: phaseOneVersion === "A" ? currentQuestion : versionBQuestionIndex
      }
    }));
  }, [phase, phaseOneVersion, phaseOneScreen, currentQuestion, versionBQuestionIndex]);

  useEffect(() => {
    phase2SelectedValuesRef.current = phase2SelectedValues;
  }, [phase2SelectedValues]);

  useEffect(() => {
    if (phaseOneScreen !== "values") setEmojiPickerIndex(null);
  }, [phaseOneScreen]);

  useEffect(() => {
    if (phaseOneScreen !== "summary") setSummaryEmojiPickerKey(null);
  }, [phaseOneScreen]);

  useEffect(() => {
    if (phase !== 2 || phaseTwoScreen !== "shapes") setDrawEmojiPickerIndex(null);
  }, [phase, phaseTwoScreen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PARTICIPANT_SESSION_STORAGE_KEY, participantSessionId);
  }, [participantSessionId]);

  useEffect(() => {
    if (typeof window === "undefined" || researcherMode || participantDraftRestoredRef.current) return;
    const initialSessionId = cleanValueText(initialParticipantSessionIdRef.current);
    if (!initialSessionId) return;
    const savedDraft = readParticipantSessionDraft(initialSessionId);
    if (!savedDraft) return;
    participantDraftRestoredRef.current = true;
    applyParticipantSession(savedDraft, {
      phase: savedDraft.phase ?? savedDraft.phaseTwo?.phase ?? 1,
      screen: savedDraft.phaseOne?.currentScreen || "questions"
    });
  }, [researcherMode]);

  useEffect(() => {
    if (typeof window === "undefined" || researcherMode || !participantSessionId.trim()) return undefined;

    function maybeApplyImportedValues(session) {
      if (!session || session.sessionId !== participantSessionId) return;
      const waitingForAiValues =
        phase === 1 &&
        phaseOneScreen === "values" &&
        ((phaseOneVersion === "A" && values.length === 0) ||
          (phaseOneVersion === "B" &&
            !versionBBoardItems.some((item) => item.type === "text" && item.text?.trim())));
      const toolValues =
        phaseOneVersion === "B"
          ? session.toolB?.identifiedValues || []
          : session.toolA?.identifiedValues || [];
      if (!Array.isArray(toolValues) || toolValues.length === 0) return;
      if (!waitingForAiValues) return;
      applyParticipantSession(session, { tool: phaseOneVersion, screen: "values" });
    }

    function handleStorage(event) {
      if (event.key !== getParticipantSessionDraftKey(participantSessionId) || !event.newValue) return;
      try {
        maybeApplyImportedValues(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed drafts from other tabs.
      }
    }

    let channel = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(PARTICIPANT_SESSION_SYNC_CHANNEL);
      channel.onmessage = (event) => maybeApplyImportedValues(event.data?.session);
    }

    window.addEventListener("storage", handleStorage);

    const waitingForAiValues =
      phase === 1 &&
      phaseOneScreen === "values" &&
      ((phaseOneVersion === "A" && values.length === 0) ||
        (phaseOneVersion === "B" &&
          !versionBBoardItems.some((item) => item.type === "text" && item.text?.trim())));

    let pollInterval = null;
    if (waitingForAiValues) {
      pollInterval = setInterval(async () => {
        try {
          const session = await loadParticipantSessionRemote(participantSessionId);
          maybeApplyImportedValues(session);
        } catch {
          // The researcher may not have imported AI values into this local draft yet.
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [participantSessionId, researcherMode, phase, phaseOneScreen, phaseOneVersion, values.length, versionBBoardItems]);

  const currentQ = QUESTIONS[currentQuestion];
  const currentBQ = VERSION_B_QUESTIONS[versionBQuestionIndex];
  const versionBSelectedBoardItem = versionBBoardItems.find((item) => item.id === versionBSelectedBoardItemId) ?? null;
  const versionBSelectedBoardImageUrl =
    versionBSelectedBoardItem?.type === "image" ? versionBSelectedBoardItem.photo?.url : undefined;
  const speechSupported =
    typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const phaseOneGoalText = useMemo(() => {
    const useCombinedGoals = phaseOneScreen === "summary" || phase === 2;
    if (useCombinedGoals) {
      const parts = [];
      if (phase2SelectedGoalSources.includes("A")) {
        const summary = toolAGoalData.summary.trim();
        if (summary) {
          parts.push(`Tool A: ${summary}`);
        } else {
          const toolAParts = [];
          if (toolAGoalData.action.trim()) toolAParts.push(`🎯 ${toolAGoalData.action.trim()}`);
          if (toolAGoalData.progress.trim()) toolAParts.push(`📏 ${toolAGoalData.progress.trim()}`);
          if (toolAGoalData.meaning.trim()) toolAParts.push(`💜 ${toolAGoalData.meaning.trim()}`);
          if (toolAGoalData.timing.trim()) toolAParts.push(`⏰ ${toolAGoalData.timing.trim()}`);
          if (toolAParts.length) parts.push(`Tool A: ${toolAParts.join(" · ")}`);
        }
      }
      if (phase2SelectedGoalSources.includes("B")) {
        const toolBParts = [];
        if (versionBGoalShort.trim()) toolBParts.push(`Short-term: ${versionBGoalShort.trim()}`);
        if (versionBGoalLong.trim()) toolBParts.push(`Long-term: ${versionBGoalLong.trim()}`);
        if (toolBParts.length) {
          parts.push(`Tool B: ${toolBParts.join(" · ")}`);
        }
      }
      return parts.join(" · ");
    }
    if (phaseOneVersion === "B") {
      return [
        versionBGoalShort.trim() ? `Short-term: ${versionBGoalShort.trim()}` : "",
        versionBGoalLong.trim() ? `Long-term: ${versionBGoalLong.trim()}` : ""
      ]
        .filter(Boolean)
        .join(" · ");
    }
    return (
      goalData.summary.trim() ||
      [
        goalData.action.trim() ? `🎯 ${goalData.action.trim()}` : "",
        goalData.progress.trim() ? `📏 ${goalData.progress.trim()}` : "",
        goalData.meaning.trim() ? `💜 ${goalData.meaning.trim()}` : "",
        goalData.timing.trim() ? `⏰ ${goalData.timing.trim()}` : ""
      ]
        .filter(Boolean)
        .join(" · ")
    );
  }, [
    phaseOneScreen,
    phase,
    toolAGoalData,
    versionBGoalShort,
    versionBGoalLong,
    phaseOneVersion,
    goalData,
    phase2SelectedGoalSources
  ]);

  function syncPhaseTwoDrawValues(selectedValues = phase2SelectedValuesRef.current) {
    const selected = selectedValues.map((value) => value.trim()).filter(Boolean);
    const summaryValues = summaryValueItems.map((item) => item.text.trim()).filter(Boolean);
    const currentValues = [...currentToolAValues(), ...currentToolBValues()].map((value) => value.trim()).filter(Boolean);
    const nextValues = [...new Set((selected.length ? selected : summaryValues.length ? summaryValues : currentValues).slice(0, MAX_PHASE2_VALUES))];
    canvasStatesRef.current = [];
    setDrawValues(nextValues);
    setDrawSettings(makeDefaultSettings(nextValues.length));
    setLegendThumbs([]);
  }

  const summaryValueItems = useMemo(() => {
    const items = [];
    toolAValues.forEach((text, index) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      items.push({
        key: `A-${index}-${trimmed}`,
        text: trimmed,
        source: "A",
        sourceIndex: index,
        icon: toolAValueIcons[index] || getValueIcon(trimmed)
      });
    });
    toolBValues.forEach((text, index) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      items.push({
        key: `B-${index}-${trimmed}`,
        text: trimmed,
        source: "B",
        sourceIndex: index,
        icon: toolBValueIcons[index] || getValueIcon(trimmed)
      });
    });
    return items;
  }, [toolAValues, toolAValueIcons, toolBValues, toolBValueIcons]);

  const phase2ValueIconMap = useMemo(() => {
    const map = new Map();
    summaryValueItems.forEach((item) => {
      if (!map.has(item.text)) map.set(item.text, item.icon);
    });
    return map;
  }, [summaryValueItems]);

  const phase2YouthValueItems = useMemo(
    () =>
      phase2SelectedValues
        .map((text, index) => ({
          id: `phase2-youth-${index}`,
          label: text,
          text,
          emoji: getPhase2ValueIcon(text),
          description: text
        }))
        .filter((item) => item.text.trim()),
    [phase2SelectedValues, phase2ValueIconMap]
  );

  const phaseOneSecondTool = phaseOneToolOrder[1];

  function getPhase2ValueIcon(value) {
    return phase2ValueIconMap.get(value) || getValueIcon(value);
  }

  function getPhaseOneToolStepState(tool) {
    if (phaseOneScreen === "summary") return "done";
    if (completedPhaseOneTools.includes(tool)) return "done";
    if (phaseOneVersion === tool) return "active";
    return "";
  }

  function switchPhaseOneTool(tool) {
    if (tool === phaseOneVersion && phaseOneScreen !== "summary") return;

    stopSpeechRecognition();

    let nextToolAValues = toolAValues;
    let nextToolAIcons = toolAValueIcons;
    let nextToolAGoals = toolAGoalData;
    let nextToolBValues = toolBValues;
    let nextToolBIcons = toolBValueIcons;

    if (phaseOneVersion === "A" && phaseOneScreen === "values") {
      nextToolAValues = values.map((value) => value.trim()).filter(Boolean);
      nextToolAIcons = valueIcons.slice(0, nextToolAValues.length);
      nextToolAGoals = { ...goalData };
      setToolAValues(nextToolAValues);
      setToolAValueIcons(nextToolAIcons);
      setToolAGoalData(nextToolAGoals);
    }

    if (phaseOneVersion === "B" && phaseOneScreen === "values") {
      nextToolBValues = versionBBoardItems
        .filter((item) => item.type === "text")
        .map((item) => item.text?.trim() || "")
        .filter(Boolean);
      nextToolBIcons = nextToolBValues.map((value, index) => toolBValueIcons[index] || getValueIcon(value));
      setToolBValues(nextToolBValues);
      setToolBValueIcons(nextToolBIcons);
    }

    const progress = phaseOneToolProgress[tool];
    const targetScreen = progress.screen === "values" ? "values" : "questions";

    if (phase !== 1) setPhase(1);
    setPhaseOneVersion(tool);
    setPhaseOneScreen(targetScreen);

    if (tool === "A") {
      setCurrentQuestion(Math.min(progress.questionIndex ?? 0, QUESTIONS.length - 1));
      if (targetScreen === "values") {
        setValues(nextToolAValues.length > 0 ? [...nextToolAValues] : []);
        setValueIcons(nextToolAValues.length > 0 ? [...nextToolAIcons] : []);
        setGoalData({ ...nextToolAGoals });
      }
    } else {
      setVersionBQuestionIndex(Math.min(progress.questionIndex ?? 0, VERSION_B_QUESTIONS.length - 1));
    }
  }

  const otherPhaseOneTool = phaseOneVersion === "A" ? "B" : "A";
  const continueFromValuesLabel = completedPhaseOneTools.includes(otherPhaseOneTool)
    ? "Continue to summary →"
    : `Continue to Tool ${otherPhaseOneTool} →`;

  const groupedComponents = useMemo(
    () =>
      componentTray.reduce((groups, component) => {
        const key = component.owner;
        if (!groups[key]) groups[key] = { label: component.ownerLabel, items: [] };
        groups[key].items.push(component);
        return groups;
      }, {}),
    [componentTray]
  );

  const drawComposite = useCallback(() => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 400, 340);
    ctx.fillStyle = "#f7f5ef";
    ctx.fillRect(0, 0, 400, 340);
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.13)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 300);
    ctx.lineTo(370, 50);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(200, 170, 120, 0, Math.PI * 1.1);
    ctx.stroke();
    ctx.strokeStyle = "rgba(180,0,0,0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(35, 215);
    ctx.lineTo(105, 215);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 250);
    ctx.lineTo(100, 250);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.arc(305, 272, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    compositeItemsRef.current.forEach((item) => {
      const { w, h } = getItemBounds(item);
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotation);
      if (item.placeholder) {
        ctx.fillStyle = COLORS[item.valueIdx % COLORS.length];
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(0, 0, 36, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (item.img) {
        ctx.drawImage(item.img, -w / 2, -h / 2, w, h);
      }
      ctx.restore();
    });

    const selectedIdx = selectedIdxRef.current;
    const selectedItem = selectedIdx !== null ? compositeItemsRef.current[selectedIdx] : null;
    if (!selectedItem) return;

    const { w, h, hw, hh } = getItemBounds(selectedItem);
    const handles = getHandles(selectedItem);
    ctx.save();
    ctx.translate(selectedItem.x, selectedItem.y);
    ctx.rotate(selectedItem.rotation);
    ctx.strokeStyle = "#378ADD";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(-hw - 4, -hh - 4, w + 8, h + 8);
    ctx.setLineDash([]);
    ctx.strokeStyle = "#378ADD";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.lineTo(0, -hh - 24);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#378ADD";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(handles.resize.x - 6, handles.resize.y - 6, 12, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#378ADD";
    ctx.beginPath();
    ctx.arc(handles.rotate.x, handles.rotate.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("↻", handles.rotate.x, handles.rotate.y);
    ctx.fillStyle = "#E24B4A";
    ctx.beginPath();
    ctx.arc(handles.delete.x, handles.delete.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("×", handles.delete.x, handles.delete.y);
  }, []);

  const drawSharedCanvas = useCallback(() => {
    const canvas = sharedCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sharedStrokesRef.current.forEach((stroke) => {
      if (stroke.pts.length < 2) return;
      ctx.save();
      ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.pts[0].x, stroke.pts[0].y);
      stroke.pts.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.stroke();
      ctx.restore();
    });
  }, []);

  const drawCompositeOverlay = useCallback(() => {
    const canvas = compositeDrawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    compositeStrokesRef.current.forEach((stroke) => {
      if (stroke.pts.length < 2) return;
      ctx.save();
      ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(stroke.pts[0].x, stroke.pts[0].y);
      stroke.pts.forEach((point) => ctx.lineTo(point.x, point.y));
      ctx.stroke();
      ctx.restore();
    });
  }, []);

  useEffect(() => {
    if (phase !== 2 || phaseTwoScreen !== "shapes") return;

    canvasStatesRef.current = drawValues.map((valueName, index) => {
      const canvas = drawCanvasRefs.current[index];
      if (!canvas) return null;
      const previous = canvasStatesRef.current[index];
      canvas.width = canvas.offsetWidth || 580;
      const settings = drawSettings[index] || { tool: "free", colorIndex: 0, brushSize: 12 };
      const state = {
        cv: canvas,
        ctx: canvas.getContext("2d"),
        tool: settings.tool,
        sticker: settings.sticker || STICKER_OPTIONS[0],
        color: COLORS[settings.colorIndex],
        brushSize: settings.brushSize,
        strokes: previous?.valueName === valueName ? previous.strokes : [],
        shapes: previous?.valueName === valueName ? previous.shapes : [],
        stickers: previous?.valueName === valueName ? previous.stickers || [] : [],
        selectedStickerIndex: previous?.valueName === valueName ? previous.selectedStickerIndex ?? null : null,
        selectedObject: previous?.valueName === valueName ? previous.selectedObject ?? null : null,
        drawing: false,
        valueName,
        valueIdx: index
      };
      drawStoredCanvas(state);
      return state;
    });
  }, [drawValues, phase, phaseTwoScreen]);

  useEffect(() => {
    setVersionBPhotoPanel(null);
    setVersionBDrawEmojiPickerIndex(null);
  }, [versionBQuestionIndex]);

  useEffect(() => {
    if (phaseOneVersion !== "B" || phaseOneScreen !== "questions" || versionBPhotoPanel !== "draw") return;

    const index = versionBQuestionIndex;
    const canvas = versionBDrawCanvasRefs.current[index];
    if (!canvas) return;
    const previous = versionBCanvasStatesRef.current[index];
    canvas.width = canvas.offsetWidth || 580;
    const settings = versionBDrawSettings[index] || { tool: "free", colorIndex: 0, brushSize: 12 };
    const state = {
      cv: canvas,
      ctx: canvas.getContext("2d"),
      tool: settings.tool,
      sticker: settings.sticker || STICKER_OPTIONS[0],
      color: COLORS[settings.colorIndex],
      brushSize: settings.brushSize,
      strokes: previous?.questionIndex === index ? previous.strokes : [],
      shapes: previous?.questionIndex === index ? previous.shapes : [],
      stickers: previous?.questionIndex === index ? previous.stickers || [] : [],
      selectedStickerIndex: previous?.questionIndex === index ? previous.selectedStickerIndex ?? null : null,
      selectedObject: previous?.questionIndex === index ? previous.selectedObject ?? null : null,
      drawing: false,
      questionIndex: index
    };
    versionBCanvasStatesRef.current[index] = state;
    drawStoredCanvas(state);
  }, [phaseOneVersion, phaseOneScreen, versionBPhotoPanel, versionBQuestionIndex, versionBDrawSettings]);

  useEffect(() => {
    if (phase === 2 && phaseTwoScreen === "composite") drawComposite();
  }, [drawComposite, phase, phaseTwoScreen]);

  useEffect(() => {
    if (phase !== 2 || phaseTwoScreen !== "composite") return undefined;

    function syncCompositeOverlaySize() {
      const overlay = compositeDrawCanvasRef.current;
      const base = compositeCanvasRef.current;
      if (!overlay || !base) return;
      const rect = base.getBoundingClientRect();
      overlay.width = base.width;
      overlay.height = base.height;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      drawCompositeOverlay();
    }

    const frame = window.requestAnimationFrame(syncCompositeOverlaySize);
    window.addEventListener("resize", syncCompositeOverlaySize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncCompositeOverlaySize);
    };
  }, [drawCompositeOverlay, phase, phaseTwoScreen]);

  useEffect(() => {
    if (phase !== 2 || phaseTwoScreen !== "stakeholders") return undefined;

    function syncSharedCanvasSize() {
      const canvas = sharedCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      drawSharedCanvas();
    }

    const frame = window.requestAnimationFrame(syncSharedCanvasSize);
    window.addEventListener("resize", syncSharedCanvasSize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncSharedCanvasSize);
    };
  }, [drawSharedCanvas, phase, phaseTwoScreen]);

  useEffect(() => {
    function getClientX(event) {
      return event.touches?.[0]?.clientX ?? event.clientX;
    }

    function handleResizeMove(event) {
      const active = valueResizeRef.current;
      if (!active) return;
      event.preventDefault();
      const delta = (getClientX(event) - active.startX) / 90;
      setPlacedComponents((current) =>
        current.map((component) =>
          component.instanceId === active.instanceId
            ? { ...component, scale: Math.max(0.55, Math.min(2.2, active.startScale + delta)) }
            : component
        )
      );
    }

    function handleResizeEnd() {
      valueResizeRef.current = null;
    }

    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
    window.addEventListener("touchmove", handleResizeMove, { passive: false });
    window.addEventListener("touchend", handleResizeEnd);
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
      window.removeEventListener("touchmove", handleResizeMove);
      window.removeEventListener("touchend", handleResizeEnd);
    };
  }, []);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    []
  );

  function updateAnswer(value) {
    setAnswers((current) => current.map((answer, index) => (index === currentQuestion ? value : answer)));
  }

  function updateVersionBAnswer(questionIndex, value) {
    setVersionBAnswers((current) => current.map((answer, index) => (index === questionIndex ? value : answer)));
  }

  useEffect(() => {
    if (!participantIntroComplete || researcherMode || !participantSessionId.trim()) return;
    persistParticipantDraft();
  }, [
    participantIntroComplete,
    researcherMode,
    participantSessionId,
    answers,
    versionBAnswers,
    versionBPhotos,
    values,
    valueIcons,
    toolAValues,
    toolAValueIcons,
    toolAGoalData,
    toolBValues,
    toolBValueIcons,
    versionBBoardItems,
    versionBGoalShort,
    versionBGoalLong,
    goalData,
    completedPhaseOneTools,
    phaseOneVersion,
    phaseOneScreen,
    phaseOneToolProgress,
    currentQuestion,
    versionBQuestionIndex,
    phase2SelectedValues,
    phase2SelectedGoalSources,
    aiSuggestedValues,
    phase,
    phaseTwoScreen,
    pictureTitle,
    legendThumbs,
    drawValues,
    drawSettings,
    placedComponents,
    componentTray,
    shareTargets
  ]);

  useEffect(() => {
    if (!participantIntroComplete || researcherMode || !participantSessionId.trim()) return undefined;

    const timer = setTimeout(async () => {
      try {
        const draft = await buildParticipantSessionExportAsync();
        await saveParticipantSessionRemote({
          ...draft,
          sessionStatus: "in_progress",
          updatedAt: new Date().toISOString()
        });
        setParticipantSyncStatus("");
      } catch {
        setParticipantSyncStatus("Could not save this draft in the browser. Ask the researcher for help.");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    participantIntroComplete,
    researcherMode,
    participantSessionId,
    answers,
    versionBAnswers,
    versionBPhotos,
    values,
    valueIcons,
    toolAValues,
    toolAValueIcons,
    toolAGoalData,
    toolBValues,
    toolBValueIcons,
    versionBBoardItems,
    versionBGoalShort,
    versionBGoalLong,
    goalData,
    completedPhaseOneTools,
    phaseOneVersion,
    phaseOneScreen,
    phaseOneToolProgress,
    currentQuestion,
    versionBQuestionIndex,
    phase2SelectedValues,
    phase2SelectedGoalSources,
    aiSuggestedValues,
    phase,
    phaseTwoScreen,
    pictureTitle,
    legendThumbs,
    drawValues,
    drawSettings,
    placedComponents,
    componentTray,
    shareTargets
  ]);

  useEffect(() => {
    if (!researcherMode) return undefined;

    function handleDraftUpdate(event) {
      const sessionId = cleanValueText(researcherSessionLookup);
      if (!sessionId) return;
      if (event?.key && event.key !== getParticipantSessionDraftKey(sessionId)) return;
      setResearcherDraftTick((current) => current + 1);
    }

    window.addEventListener("storage", handleDraftUpdate);
    let channel = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(PARTICIPANT_SESSION_SYNC_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data?.session?.sessionId === researcherSessionLookup) {
          setResearcherDraftTick((current) => current + 1);
        }
      };
    }

    return () => {
      window.removeEventListener("storage", handleDraftUpdate);
      channel?.close();
    };
  }, [researcherMode, researcherSessionLookup]);

  useEffect(() => {
    if (!researcherMode || !cleanValueText(researcherSessionLookup)) return;
    void loadParticipantDraftForResearcher();
  }, [researcherMode]);

  function updateVersionBPhoto(questionIndex, file) {
    if (!file) return;
    setVersionBPhotos((current) =>
      current.map((photo, index) => {
        if (index !== questionIndex) return photo;
        releaseUploadedPhoto(photo);
        return { name: file.name, url: URL.createObjectURL(file), isUpload: true };
      })
    );
  }

  function clearVersionBPhoto(questionIndex) {
    setVersionBPhotos((current) =>
      current.map((photo, index) => {
        if (index !== questionIndex) return photo;
        releaseUploadedPhoto(photo);
        return null;
      })
    );
  }

  function addToVersionBQuestionLibrary(file) {
    if (!file) return;
    const item = {
      id: `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      url: URL.createObjectURL(file),
      source: "upload",
      isUpload: true
    };
    setVersionBQuestionLibrary((current) => [...current, item]);
    setVersionBPhotos((current) =>
      current.map((photo, index) => {
        if (index !== versionBQuestionIndex) return photo;
        releaseUploadedPhoto(photo);
        return { name: item.name, url: item.url };
      })
    );
  }

  function selectVersionBQuestionLibraryImage(libraryItem) {
    setVersionBPhotos((current) =>
      current.map((photo, index) => {
        if (index !== versionBQuestionIndex) return photo;
        releaseUploadedPhoto(photo);
        return { name: libraryItem.name, url: libraryItem.url };
      })
    );
  }

  function stopSpeechRecognition() {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setListeningQuestion(null);
    setSpeechDraft("");
  }

  function appendTranscript(questionKey, transcript) {
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript) return;
    const [version, rawIndex] = String(questionKey).split("-");
    const questionIndex = Number(rawIndex);
    if (version === "B") {
      setVersionBAnswers((current) =>
        current.map((answer, index) => {
          if (index !== questionIndex) return answer;
          const separator = answer.trim() ? " " : "";
          return `${answer.trimEnd()}${separator}${cleanTranscript}`;
        })
      );
      return;
    }
    setAnswers((current) =>
      current.map((answer, index) => {
        if (index !== questionIndex) return answer;
        const separator = answer.trim() ? " " : "";
        return `${answer.trimEnd()}${separator}${cleanTranscript}`;
      })
    );
  }

  function toggleSpeechInput(questionIndex) {
    if (!speechSupported) {
      return;
    }

    if (listeningQuestion === questionIndex) {
      stopSpeechRecognition();
      return;
    }

    stopSpeechRecognition();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      Array.from(event.results)
        .slice(event.resultIndex)
        .forEach((result) => {
          const transcript = result[0]?.transcript || "";
          if (result.isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        });
      appendTranscript(questionIndex, finalTranscript);
      setSpeechDraft(interimTranscript.trim());
    };
    recognition.onerror = () => {
      setListeningQuestion(null);
      setSpeechDraft("");
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListeningQuestion(null);
      setSpeechDraft("");
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setListeningQuestion(questionIndex);
    recognition.start();
  }

  function prevQuestion() {
    stopSpeechRecognition();
    setCurrentQuestion((current) => Math.max(0, current - 1));
  }

  function nextQuestion() {
    stopSpeechRecognition();
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion((current) => current + 1);
      return;
    }
    setValues([]);
    setValueIcons([]);
    setPhaseOneScreen("values");
    window.setTimeout(() => {
      void syncFullDraftForResearcher();
    }, 0);
  }

  function addImageToVersionBBoard(libraryItem) {
    const selected = versionBBoardItems.find((item) => item.id === versionBSelectedBoardItemId);
    if (selected?.type === "image") {
      setVersionBBoardItems((current) =>
        current.map((item) =>
          item.id === selected.id
            ? { ...item, photo: { name: libraryItem.name, url: libraryItem.url } }
            : item
        )
      );
      return;
    }

    const nextId = newVersionBCardId();
    setVersionBBoardItems((current) => {
      const position = getNextVersionBBoardImagePosition(current.filter((item) => item.type === "image").length);
      return [
        ...current,
        {
          id: nextId,
          type: "image",
          x: position.x,
          y: position.y,
          photo: { name: libraryItem.name, url: libraryItem.url }
        }
      ];
    });
    setVersionBSelectedBoardItemId(nextId);
  }

  function addToVersionBValuesLibrary(file) {
    if (!file) return;
    const item = {
      id: `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      url: URL.createObjectURL(file),
      source: "upload",
      isUpload: true
    };
    setVersionBValuesLibrary((current) => [...current, item]);
    addImageToVersionBBoard(item);
  }

  function selectVersionBValuesLibraryImage(libraryItem) {
    addImageToVersionBBoard(libraryItem);
  }

  function generateVersionBValuesAiImage(prompt) {
    const item = createAiLibraryItem(prompt);
    setVersionBValuesLibrary((current) => [...current, item]);
    addImageToVersionBBoard(item);
  }

  function completeVersionBQuestions() {
    stopSpeechRecognition();
    const seeded = [];
    while (seeded.length < VERSION_B_VALUE_SLOTS) seeded.push("");
    const initial = seeded.slice(0, VERSION_B_VALUE_SLOTS);
    const textItems = [];
    const questionPhotoItems = createVersionBBoardImageItemsFromQuestionPhotos(versionBPhotos);
    setValues(initial.filter((text) => text.trim()));
    setValueIcons([]);
    setVersionBBoardItems([...textItems, ...questionPhotoItems]);
    setVersionBSelectedBoardItemId(null);
    setPhaseOneScreen("values");
    window.setTimeout(() => {
      void syncFullDraftForResearcher();
    }, 0);
  }

  function updateVersionBBoardItemText(itemId, text) {
    setVersionBBoardItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, text } : item))
    );
  }

  function removeVersionBBoardItem(itemId) {
    setVersionBBoardItems((current) => current.filter((item) => item.id !== itemId));
    setVersionBSelectedBoardItemId((current) => (current === itemId ? null : current));
  }

  function addVersionBBoardText() {
    const nextId = newVersionBCardId();
    setVersionBBoardItems((current) => {
      const textCount = current.filter((item) => item.type === "text").length;
      const position = {
        x: clampBoardPosition(10 + (textCount * 11) % 52),
        y: clampBoardPosition(12 + (textCount * 15) % 50)
      };
      return [
        ...current,
        {
          id: nextId,
          type: "text",
          x: position.x,
          y: position.y,
          text: ""
        }
      ];
    });
    setVersionBSelectedBoardItemId(nextId);
  }

  function startVersionBBoardDrag(itemId, event) {
    const board = versionBBoardRef.current;
    if (!board || event.button !== 0) return;

    const target = event.target;
    if (target instanceof Element && target.closest(".version-b-board-item-remove, textarea, input, button")) {
      return;
    }

    event.preventDefault();
    const rect = board.getBoundingClientRect();
    const item = versionBBoardItems.find((boardItem) => boardItem.id === itemId);
    if (!item) return;

    setVersionBSelectedBoardItemId(itemId);
    versionBBoardDragRef.current = {
      itemId,
      offsetX: ((event.clientX - rect.left) / rect.width) * 100 - item.x,
      offsetY: ((event.clientY - rect.top) / rect.height) * 100 - item.y
    };

    function onMove(moveEvent) {
      const dragState = versionBBoardDragRef.current;
      if (!dragState) return;
      const nextX = clampBoardPosition(
        ((moveEvent.clientX - rect.left) / rect.width) * 100 - dragState.offsetX,
        item.type === "image" ? 72 : 62
      );
      const nextY = clampBoardPosition(
        ((moveEvent.clientY - rect.top) / rect.height) * 100 - dragState.offsetY,
        item.type === "image" ? 78 : 72
      );
      setVersionBBoardItems((current) =>
        current.map((boardItem) =>
          boardItem.id === dragState.itemId ? { ...boardItem, x: nextX, y: nextY } : boardItem
        )
      );
    }

    function onUp() {
      versionBBoardDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function prevVersionBQuestion() {
    stopSpeechRecognition();
    setVersionBQuestionIndex((current) => Math.max(0, current - 1));
  }

  function nextVersionBQuestion() {
    stopSpeechRecognition();
    if (versionBQuestionIndex < VERSION_B_QUESTIONS.length - 1) {
      setVersionBQuestionIndex((current) => current + 1);
      return;
    }
    completeVersionBQuestions();
  }

  function moveValue(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= values.length) return;
    setValues((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setValueIcons((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addValue() {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    setValues((current) => [...current, trimmed]);
    setValueIcons((current) => [...current, null]);
    setNewValue("");
  }

  function updateValue(index, value) {
    setValues((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function removeValue(index) {
    setValues((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setValueIcons((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function setValueIcon(index, emoji) {
    setValueIcons((current) => {
      const next = [...current];
      next[index] = emoji;
      return next;
    });
  }

  function setSummaryValueIcon(source, sourceIndex, emoji) {
    if (source === "A") {
      setToolAValueIcons((current) => {
        const next = [...current];
        next[sourceIndex] = emoji;
        return next;
      });
      return;
    }
    if (source === "B") {
      setToolBValueIcons((current) => {
        const next = [...current];
        next[sourceIndex] = emoji;
        return next;
      });
      return;
    }
    if (source === "AI") {
      setAiSuggestedValues((current) =>
        current.map((value, index) => (index === sourceIndex ? { ...value, icon: emoji } : value))
      );
    }
  }

  function toggleEmojiPicker(index) {
    setEmojiPickerIndex((current) => (current === index ? null : index));
  }

  function saveGoalField(field, value) {
    const clean = value.trim() || GOAL_PLACEHOLDERS[field];
    setGoalData((current) => ({ ...current, [field]: clean }));
    setEditingGoal(null);
  }

  function updateGoalData(field, value) {
    setGoalData((current) => ({ ...current, [field]: value }));
  }

  function updateToolAGoalData(field, value) {
    setToolAGoalData((current) => ({ ...current, [field]: value }));
  }

  function togglePhase2GoalSource(source) {
    setPhase2SelectedGoalSources((current) => {
      if (current.includes(source)) {
        return current.filter((item) => item !== source);
      }
      return [...current, source];
    });
  }

  function currentToolAValues() {
    if (toolAValues.length > 0) return toolAValues;
    if (phaseOneVersion === "A") return values.map((value) => value.trim()).filter(Boolean);
    return [];
  }

  function currentToolBValues() {
    if (toolBValues.length > 0) return toolBValues;
    return versionBBoardItems
      .filter((item) => item.type === "text")
      .map((item) => item.text?.trim() || "")
      .filter(Boolean);
  }

  function snapshotPerValueDrawings() {
    const snapshots = drawValues
      .map((valueName, index) => {
        const canvasState = canvasStatesRef.current[index];
        const exported = exportCroppedPNG(canvasState);
        if (!exported?.dataURL) return null;
        return {
          valueName: canvasState?.valueName || valueName,
          pngDataUrl: exported.dataURL,
          pngWidth: exported.w,
          pngHeight: exported.h
        };
      })
      .filter(Boolean);
    if (snapshots.length > 0) {
      perValueDrawingImagesRef.current = snapshots;
    }
    return perValueDrawingImagesRef.current;
  }

  function collectPerValueDrawingsForExport() {
    snapshotPerValueDrawings();
    if (perValueDrawingImagesRef.current.length > 0) {
      return perValueDrawingImagesRef.current;
    }

    return drawValues
      .map((valueName, index) => {
        const item = compositeItemsRef.current[index];
        if (item?.img?.src) {
          return {
            valueName: item.valueName || valueName,
            pngDataUrl: item.img.src,
            pngWidth: item.natW,
            pngHeight: item.natH
          };
        }
        const youthComponent = componentTray.find((component) => component.id === `youth-${index}`);
        if (youthComponent?.src) {
          return {
            valueName: youthComponent.label || valueName,
            pngDataUrl: youthComponent.src,
            pngWidth: youthComponent.w,
            pngHeight: youthComponent.h
          };
        }
        if (legendThumbs[index]) {
          return {
            valueName,
            pngDataUrl: legendThumbs[index],
            pngWidth: 44,
            pngHeight: 44
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  function buildParticipantSessionExport() {
    const exportedToolAValues = currentToolAValues();
    const exportedToolBValues = currentToolBValues();
    return {
      schema: PARTICIPANT_EXPORT_SCHEMA,
      sessionId: participantSessionId,
      sessionStatus: sessionSaved ? "phase2_saved" : "in_progress",
      participantFinished,
      checkpoints: readParticipantSessionDraft(participantSessionId)?.checkpoints || {},
      exportedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phase: phase,
      phaseOne: {
        toolOrder: phaseOneToolOrder,
        completedTools: completedPhaseOneTools,
        currentTool: phaseOneVersion,
        currentScreen: phaseOneScreen,
        currentQuestionIndex: phaseOneVersion === "A" ? currentQuestion : versionBQuestionIndex,
        toolProgress: phaseOneToolProgress
      },
      toolA: {
        questions: QUESTIONS.map((question, index) => ({
          num: question.num,
          text: question.text,
          hints: question.hints,
          answer: answers[index] || ""
        })),
        identifiedValues: exportedToolAValues,
        valueIcons: toolAValueIcons,
        goal: toolAValues.length > 0 ? toolAGoalData : goalData
      },
      toolB: {
        questions: VERSION_B_QUESTIONS.map((question, index) => ({
          num: question.num,
          text: question.text,
          answer: versionBAnswers[index] || "",
          photo: photoMetadata(versionBPhotos[index])
        })),
        boardItems: versionBBoardItems.map((item) =>
          item.type === "image"
            ? {
                id: item.id,
                type: item.type,
                x: item.x,
                y: item.y,
                photo: photoMetadata(item.photo)
              }
            : {
                id: item.id,
                type: item.type,
                x: item.x,
                y: item.y,
                text: item.text || ""
              }
        ),
        identifiedValues: exportedToolBValues,
        valueIcons: toolBValueIcons,
        goals: {
          shortTerm: versionBGoalShort,
          longTerm: versionBGoalLong
        }
      },
      aiGeneratedValues: aiSuggestedValues,
      aiGeneratedValuesByTool: {
        ...(readParticipantSessionDraft(participantSessionId)?.aiGeneratedValuesByTool || {}),
        ...(aiSuggestedValues.length
          ? { [phaseOneVersion]: aiSuggestedValues }
          : {})
      },
      phase2: {
        selectedValues: phase2SelectedValues,
        selectedGoalSources: phase2SelectedGoalSources
      },
      phaseTwo: buildPhaseTwoExport({
        phase,
        phaseTwoScreen,
        drawValues,
        perValueDrawings: collectPerValueDrawingsForExport(),
        pictureTitle,
        legendThumbs,
        shareTargets,
        compositeFinalImage:
          phaseTwoScreen === "composite" || phaseTwoScreen === "stakeholders"
            ? serializeFinalImage(
                exportCompositeFinalPNG(compositeItemsRef.current, compositeStrokesRef.current)
              )
            : null
      }),
      events: sessionEventsRef.current
    };
  }

  async function buildParticipantSessionExportAsync() {
    const session = buildParticipantSessionExport();
    const enrichedQuestions = await Promise.all(
      VERSION_B_QUESTIONS.map(async (_, index) => ({
        ...session.toolB.questions[index],
        photo: versionBPhotos[index] ? await serializePhotoForExport(versionBPhotos[index]) : null
      }))
    );
    const enrichedBoardItems = await Promise.all(
      versionBBoardItems.map(async (item) =>
        item.type === "image"
          ? {
              id: item.id,
              type: item.type,
              x: item.x,
              y: item.y,
              photo: await serializePhotoForExport(item.photo)
            }
          : {
              id: item.id,
              type: item.type,
              x: item.x,
              y: item.y,
              text: item.text || ""
            }
      )
    );

    const perValueDrawings = collectPerValueDrawingsForExport();
    let compositeFinalImage = session.phaseTwo?.toolC?.composite?.finalImage || null;
    if (phaseTwoScreen === "composite" || phaseTwoScreen === "stakeholders") {
      compositeFinalImage = serializeFinalImage(
        exportCompositeFinalPNG(compositeItemsRef.current, compositeStrokesRef.current)
      );
    }

    let stakeholderFinalImage = session.phaseTwo?.toolC?.stakeholders?.finalImage || null;
    if (phaseTwoScreen === "stakeholders") {
      const boardCanvas = sharedCanvasRef.current;
      const boardWidth = boardCanvas?.width || 560;
      const boardHeight = boardCanvas?.height || 360;
      stakeholderFinalImage = serializeFinalImage(
        await exportStakeholderBoardPNG(placedComponents, sharedStrokesRef.current, boardWidth, boardHeight)
      );
    }

    return {
      ...session,
      toolB: {
        ...session.toolB,
        questions: enrichedQuestions,
        boardItems: enrichedBoardItems
      },
      phaseTwo: {
        ...session.phaseTwo,
        toolC: {
          ...session.phaseTwo.toolC,
          perValueDrawings,
          composite: {
            ...session.phaseTwo.toolC.composite,
            finalImage: compositeFinalImage
          },
          stakeholders: {
            ...session.phaseTwo.toolC.stakeholders,
            finalImage: stakeholderFinalImage
          }
        }
      }
    };
  }

  function buildToolResponseExport(session, tool) {
    const targetTool = tool === "B" ? "B" : "A";
    const sourceSession = session || buildParticipantSessionExport();
    const toolPayload = targetTool === "B" ? sourceSession.toolB : sourceSession.toolA;
    return {
      schema: PARTICIPANT_EXPORT_SCHEMA,
      exportType: "tool-response",
      sessionId: sourceSession.sessionId,
      tool: targetTool,
      exportedAt: new Date().toISOString(),
      instructions:
        "Use only this tool's participant responses to elicit values. Return JSON with schema seattle-childrens.ai-values.v1, the same sessionId, this tool, and a values array.",
      responses: toolPayload?.questions || [],
      goals: toolPayload?.goals || toolPayload?.goal || {},
      boardItems: targetTool === "B" ? toolPayload?.boardItems || [] : undefined,
      existingValues: toolPayload?.identifiedValues || []
    };
  }

  function persistParticipantDraft(patch = {}) {
    const session = {
      ...buildParticipantSessionExport(),
      ...patch,
      sessionId: cleanValueText(patch.sessionId || participantSessionId) || participantSessionId,
      updatedAt: new Date().toISOString(),
      sessionStatus: patch.sessionStatus || (sessionSaved ? "completed" : "in_progress")
    };
    writeParticipantSessionDraft(session);
    return session;
  }

  async function syncFullDraftForResearcher() {
    const session = await buildParticipantSessionExportAsync();
    const draft = {
      ...session,
      sessionStatus: "in_progress",
      updatedAt: new Date().toISOString()
    };
    writeParticipantSessionDraft(draft);
    try {
      await saveParticipantSessionRemote(draft);
    } catch {
      // Local draft remains available on this device.
    }
    return draft;
  }

  async function syncInProgressDraftForResearcher() {
    await syncFullDraftForResearcher();
  }

  async function finishParticipantSession() {
    setSessionSaveStatus("Saving your final images...");
    try {
      snapshotPerValueDrawings();
      const draft = await buildParticipantSessionExportAsync();
      const savedDraft = {
        ...draft,
        sessionStatus: "in_progress",
        participantFinished: true,
        updatedAt: new Date().toISOString()
      };
      writeParticipantSessionDraft(savedDraft);
      await saveParticipantSessionRemote(savedDraft, { checkpoint: "phase2" });
      setParticipantFinished(true);
      setSessionSaveStatus("All done! The researcher can download the JSON log and embedded PNG data from this browser.");
    } catch (error) {
      setSessionSaveStatus(`Could not save session: ${error.message}`);
    }
  }

  async function getSessionForResearcherSave(cleanSessionId) {
    const session = await resolveParticipantDraft(cleanSessionId);
    if (!session) throw new Error("Participant session not found");
    return session;
  }

  async function savePhase1CheckpointAsResearcher() {
    const cleanSessionId = cleanValueText(researcherSessionLookup);
    if (!cleanSessionId) {
      setResearcherStatus("Enter a participant ID first.");
      return;
    }
    let session;
    try {
      session = await getSessionForResearcherSave(cleanSessionId);
    } catch (error) {
      setResearcherStatus(error.message || "Load the participant draft first.");
      return;
    }
    const phase1Complete =
      session.phaseOne?.completedTools?.length === 2 ||
      session.phaseOne?.currentScreen === "summary" ||
      session.phase >= 2;
    if (!phase1Complete) {
      setResearcherStatus(`${cleanSessionId} has not finished Phase 1 yet.`);
      return;
    }
    const checkpointSession = {
      ...session,
      sessionStatus: "phase1_saved",
      checkpoints: {
        ...(session.checkpoints || {}),
        phase1: { savedAt: new Date().toISOString() }
      },
      updatedAt: new Date().toISOString()
    };
    try {
      const leanSession = await saveParticipantSessionRemote(checkpointSession);
      const localDraft = readParticipantSessionDraft(cleanSessionId) || session;
      writeParticipantSessionDraft({
        ...localDraft,
        sessionStatus: "phase1_saved",
        checkpoints: leanSession.checkpoints || checkpointSession.checkpoints
      });
      downloadJsonFile(`${cleanSessionId}-phase1-log.json`, leanSession);
      setResearcherStatus(`Downloaded Phase 1 log for ${cleanSessionId}. Data was saved only in this browser.`);
    } catch (error) {
      setResearcherStatus(error.message || "Could not save Phase 1 log.");
    }
  }

  async function savePhase2CheckpointAsResearcher() {
    const cleanSessionId = cleanValueText(researcherSessionLookup);
    if (!cleanSessionId) {
      setResearcherStatus("Enter a participant ID first.");
      return;
    }
    let session;
    try {
      session = await getSessionForResearcherSave(cleanSessionId);
    } catch (error) {
      setResearcherStatus(error.message || "Load the participant draft first.");
      return;
    }
    const phase2Ready = session.participantFinished || session.phase === 2;
    if (!phase2Ready) {
      setResearcherStatus(`${cleanSessionId} has not finished Phase 2 yet. Ask the participant to tap Done.`);
      return;
    }
    const checkpointSession = {
      ...session,
      sessionStatus: "phase2_saved",
      checkpoints: {
        ...(session.checkpoints || {}),
        phase2: { savedAt: new Date().toISOString() }
      },
      updatedAt: new Date().toISOString()
    };
    try {
      const leanSession = await saveParticipantSessionRemote(checkpointSession);
      const localDraft = readParticipantSessionDraft(cleanSessionId) || session;
      writeParticipantSessionDraft({
        ...localDraft,
        sessionStatus: "phase2_saved",
        checkpoints: leanSession.checkpoints || checkpointSession.checkpoints
      });
      downloadJsonFile(`${cleanSessionId}-phase2-log.json`, leanSession);
      setResearcherStatus(`Downloaded Phase 2 log for ${cleanSessionId}. Tool C PNG data is embedded in the JSON.`);
    } catch (error) {
      setResearcherStatus(error.message || "Could not save Phase 2 log.");
    }
  }

  async function downloadPhase1LogData() {
    const cleanSessionId = cleanValueText(researcherSessionLookup);
    if (!cleanSessionId) {
      setResearcherStatus("Enter a participant ID first.");
      return;
    }
    try {
      const session = await getSessionForResearcherSave(cleanSessionId);
      downloadJsonFile(`${cleanSessionId}-phase1-log.json`, session);
      setResearcherStatus(`Downloaded Phase 1 log for ${cleanSessionId}.`);
    } catch (error) {
      setResearcherStatus(error.message || "Could not download Phase 1 log.");
    }
  }

  async function downloadPhase2LogData() {
    const cleanSessionId = cleanValueText(researcherSessionLookup);
    if (!cleanSessionId) {
      setResearcherStatus("Enter a participant ID first.");
      return;
    }
    try {
      const session = await getSessionForResearcherSave(cleanSessionId);
      downloadJsonFile(`${cleanSessionId}-phase2-log.json`, session);
      setResearcherStatus(`Downloaded Phase 2 log for ${cleanSessionId}. Tool C PNG data is embedded in the JSON.`);
    } catch (error) {
      setResearcherStatus(error.message || "Could not download Phase 2 log.");
    }
  }

  function applyParticipantSession(session, options = {}) {
    if (!session) return;
    const targetTool = options.tool || session.phaseOne?.currentTool || "A";
    const restoredAiValues = (
      session.aiGeneratedValuesByTool?.[targetTool] ||
      session.aiGeneratedValues ||
      []
    )
      .map(normalizeAiValue)
      .filter(Boolean);
    const restoredAValues = (session.toolA?.identifiedValues || []).map(cleanValueText).filter(Boolean);
    const restoredAIcons = session.toolA?.valueIcons || [];
    const restoredBValues = (session.toolB?.identifiedValues || []).map(cleanValueText).filter(Boolean);
    const restoredBIcons = session.toolB?.valueIcons || [];
    const activeImportedValues = targetTool === "B" ? restoredBValues : restoredAValues;
    const activeImportedIcons = targetTool === "B" ? restoredBIcons : restoredAIcons;
    const restoredBoardItems =
      session.toolB?.boardItems?.length > 0
        ? session.toolB.boardItems.map((item) =>
            item.type === "image"
              ? { ...item, photo: restorePhotoFromMetadata(item.photo) }
              : item
          )
        : createVersionBBoardItemsFromValues(restoredBValues);
    const sessionId = cleanValueText(session.sessionId || researcherSessionLookup || participantSessionId);
    setParticipantSessionId(sessionId);
    setResearcherSessionLookup(sessionId);
    setAnswers(QUESTIONS.map((_, index) => session.toolA?.questions?.[index]?.answer || ""));
    setVersionBAnswers(VERSION_B_QUESTIONS.map((_, index) => session.toolB?.questions?.[index]?.answer || ""));
    setVersionBPhotos(
      VERSION_B_QUESTIONS.map((_, index) => restorePhotoFromMetadata(session.toolB?.questions?.[index]?.photo))
    );
    setValues(activeImportedValues);
    setValueIcons(activeImportedIcons);
    setToolAValues(restoredAValues);
    setToolAValueIcons(restoredAIcons);
    setToolAGoalData({ ...GOAL_PLACEHOLDERS, ...(session.toolA?.goal || {}) });
    setToolBValues(restoredBValues);
    setToolBValueIcons(restoredBIcons);
    setVersionBBoardItems(restoredBoardItems);
    setVersionBGoalShort(session.toolB?.goals?.shortTerm || "");
    setVersionBGoalLong(session.toolB?.goals?.longTerm || "");
    setAiSuggestedValues(restoredAiValues);
    setPhase2SelectedValues(session.phase2?.selectedValues || []);
    setPhase2SelectedGoalSources(session.phase2?.selectedGoalSources || ["A", "B"]);
    const restoredCompletedTools = Array.isArray(session.phaseOne?.completedTools)
      ? session.phaseOne.completedTools
      : ["A", "B"];
    const restoredToolProgress = session.phaseOne?.toolProgress || {};
    const restoredCurrentQuestionIndex = Math.max(0, Number(session.phaseOne?.currentQuestionIndex ?? 0) || 0);
    setCompletedPhaseOneTools(restoredCompletedTools);
    setParticipantIntroComplete(true);
    setPhase(options.phase ?? session.phase ?? session.phaseTwo?.phase ?? 1);
    setPhaseOneVersion(targetTool);
    setPhaseOneToolProgress({
      A: {
        screen: restoredToolProgress.A?.screen ||
          (session.toolA?.identifiedValues?.length || restoredCompletedTools.includes("A") ? "values" : "questions"),
        questionIndex: restoredToolProgress.A?.questionIndex ?? (targetTool === "A" ? restoredCurrentQuestionIndex : 0)
      },
      B: {
        screen: restoredToolProgress.B?.screen ||
          (session.toolB?.identifiedValues?.length ||
          session.toolB?.boardItems?.length ||
          restoredCompletedTools.includes("B")
            ? "values"
            : "questions"),
        questionIndex: restoredToolProgress.B?.questionIndex ?? (targetTool === "B" ? restoredCurrentQuestionIndex : 0)
      }
    });
    if (targetTool === "A") {
      setCurrentQuestion(Math.min(restoredCurrentQuestionIndex, QUESTIONS.length - 1));
    } else {
      setVersionBQuestionIndex(Math.min(restoredCurrentQuestionIndex, VERSION_B_QUESTIONS.length - 1));
    }
    setPhaseOneScreen(options.screen || session.phaseOne?.currentScreen || "summary");
    const restoredSelectedValues = session.phase2?.selectedValues || [];
    setDrawValues(restoredSelectedValues);
    setDrawSettings(makeDefaultSettings(restoredSelectedValues.length));
    if (session.phaseTwo) {
      setPhaseTwoScreen(session.phaseTwo.currentScreen || "shapes");
      setPictureTitle(session.phaseTwo.toolC?.composite?.pictureTitle || "");
      setLegendThumbs(session.phaseTwo.toolC?.composite?.legendThumbs || []);
      setShareTargets(session.phaseTwo.toolC?.composite?.shareTargets || { caregiver: true, clinician: true });
      if (session.phaseTwo.toolC?.perValueDrawings?.length) {
        perValueDrawingImagesRef.current = session.phaseTwo.toolC.perValueDrawings;
      }
      if (!session.phaseTwo.toolC?.composite?.finalImage?.pngDataUrl) {
        compositeStrokesRef.current = session.phaseTwo.toolC?.composite?.overlayStrokes || [];
      }
      if (!session.phaseTwo.toolC?.stakeholders?.finalImage?.pngDataUrl) {
        setComponentTray(session.phaseTwo.toolC?.stakeholders?.componentTray || []);
        setPlacedComponents(session.phaseTwo.toolC?.stakeholders?.placedComponents || []);
        sharedStrokesRef.current = session.phaseTwo.toolC?.stakeholders?.sharedStrokes || [];
      }
    }
    if (Array.isArray(session.events)) {
      sessionEventsRef.current = session.events;
    }
    setSessionSaved(["phase1_saved", "phase2_saved", "completed"].includes(session.sessionStatus));
    setParticipantFinished(Boolean(session.participantFinished));
    setSessionSaveStatus(
      session.sessionStatus === "phase2_saved" || session.sessionStatus === "completed"
        ? "Session already saved by researcher."
        : session.sessionStatus === "phase1_saved"
          ? "Phase 1 saved by researcher."
          : ""
    );
  }

  async function loadParticipantDraftForResearcher() {
    const cleanSessionId = cleanValueText(researcherSessionLookup);
    if (!cleanSessionId) {
      setResearcherStatus("Enter a participant ID first.");
      return;
    }
    const session = await resolveParticipantDraft(cleanSessionId);
    if (!session) {
      setResearcherStatus(
        `No local draft found for ${cleanSessionId}. Use the same browser profile and participant ID.`
      );
      return;
    }
    applyParticipantSession(session, {
      screen: session.phaseOne?.currentScreen || "questions"
    });
    setResearcherDraftTick((current) => current + 1);
    setResearcherStatus(`Loaded local draft for ${cleanSessionId}. Storage: ${getStorageBackendLabel()}.`);
  }

  async function exportParticipantResponses() {
    const cleanSessionId = cleanValueText(researcherSessionLookup);
    if (!cleanSessionId) {
      setResearcherStatus("Enter a participant ID first.");
      return;
    }
    try {
      const draftSession = await resolveParticipantDraft(cleanSessionId);
      if (!draftSession) {
        setResearcherStatus(
          `No local draft found for ${cleanSessionId}. The participant must use this browser/profile.`
        );
        return;
      }
      const toolAReady = Boolean(draftSession.toolA?.questions?.some((question) => question.answer?.trim()));
      const toolBReady = Boolean(draftSession.toolB?.questions?.some((question) => question.answer?.trim()));
      if (researcherExportTool === "A" && !toolAReady) {
        setResearcherStatus(`${cleanSessionId} has no Tool A answers yet.`);
        return;
      }
      if (researcherExportTool === "B" && !toolBReady) {
        setResearcherStatus(`${cleanSessionId} has no Tool B answers yet.`);
        return;
      }
      setResearcherDraftTick((current) => current + 1);
      const toolExport = buildToolResponseExport(draftSession, researcherExportTool);
      downloadJsonFile(
        `${draftSession.sessionId}-tool-${researcherExportTool.toLowerCase()}-responses.json`,
        toolExport
      );
      setResearcherStatus(`Downloaded Tool ${researcherExportTool} responses for ${draftSession.sessionId}.`);
    } catch (error) {
      setResearcherStatus(
        error.message ||
          `Could not load the local draft. Storage: ${getStorageBackendLabel()}.`
      );
    }
  }

  async function applyAiValuesImport(payload) {
    const normalized = normalizeAiValuesPayload(payload);
    const targetTool = ["A", "B"].includes(String(payload.tool || payload.sourceTool || researcherImportTool).toUpperCase())
      ? String(payload.tool || payload.sourceTool || researcherImportTool).toUpperCase()
      : "A";
    const targetSessionId = cleanValueText(researcherSessionLookup) || normalized.sessionId || participantSessionId;
    if (normalized.sessionId && normalized.sessionId !== targetSessionId) {
      setResearcherStatus(
        `AI JSON was for ${normalized.sessionId}, but applying it to Participant ID ${targetSessionId}.`
      );
    }
    const importedTexts = normalized.values.map((value) => value.text);
    const importedIcons = normalized.values.map((value) => value.icon || getValueIcon(value.text));
    const importedBoardItems = [
      ...createVersionBBoardItemsFromValues(importedTexts),
      ...createVersionBBoardImageItemsFromQuestionPhotos(versionBPhotos)
    ];
    setParticipantSessionId(targetSessionId);
    setResearcherSessionLookup(targetSessionId);
    setAiSuggestedValues(normalized.values);
    if (targetTool === "A") {
      setValues(importedTexts);
      setValueIcons(importedIcons);
      setToolAValues(importedTexts);
      setToolAValueIcons(importedIcons);
    } else {
      setToolBValues(importedTexts);
      setToolBValueIcons(importedIcons);
      setVersionBBoardItems(importedBoardItems);
    }
    setCompletedPhaseOneTools((current) => (current.includes(targetTool) ? current : [...current, targetTool]));
    const baseSession = readParticipantSessionDraft(targetSessionId) || buildParticipantSessionExport();
    const aiGeneratedValuesByTool = {
      ...(baseSession.aiGeneratedValuesByTool || {}),
      [targetTool]: normalized.values
    };
    appendSessionEvent({ type: "ai_values_imported", tool: targetTool, count: normalized.values.length });
    const importedSession = {
      ...baseSession,
      schema: PARTICIPANT_EXPORT_SCHEMA,
      sessionId: targetSessionId,
      phaseOne: {
        ...baseSession.phaseOne,
        completedTools: Array.from(new Set([...(baseSession.phaseOne?.completedTools || []), targetTool])),
        currentTool: targetTool,
        currentScreen: "values"
      },
      aiGeneratedValues: normalized.values,
      aiGeneratedValuesByTool,
      toolA:
        targetTool === "A"
          ? {
              ...baseSession.toolA,
              identifiedValues: importedTexts,
              valueIcons: importedIcons
            }
          : baseSession.toolA,
      toolB:
        targetTool === "B"
          ? {
              ...baseSession.toolB,
              identifiedValues: importedTexts,
              valueIcons: importedIcons,
              boardItems: importedBoardItems
            }
          : baseSession.toolB,
      phase2: {
        ...(baseSession.phase2 || {}),
        selectedValues: baseSession.phase2?.selectedValues || [],
        selectedGoalSources: baseSession.phase2?.selectedGoalSources || phase2SelectedGoalSources
      },
      events: sessionEventsRef.current,
      sessionStatus: "in_progress"
    };
    writeParticipantSessionDraft(importedSession);
    try {
      await saveParticipantSessionRemote(importedSession);
    } catch {
      // Participant tab on the same device can still receive the draft via BroadcastChannel.
    }
    setResearcherStatus(`Updated participant values for Tool ${targetTool} (${normalized.values.length} values).`);
  }

  function importAiValuesFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        await applyAiValuesImport(payload);
      } catch (error) {
        setResearcherStatus(error.message || "Could not import AI values JSON.");
      }
    };
    reader.onerror = () => setResearcherStatus("Could not read AI values JSON file.");
    reader.readAsText(file);
  }

  async function importPastedAiValues() {
    try {
      const payload = JSON.parse(researcherJsonPaste.trim());
      await applyAiValuesImport(payload);
      setResearcherJsonPaste("");
    } catch (error) {
      setResearcherStatus(error.message || "Could not import pasted JSON.");
    }
  }

  function updateAiSuggestedValue(index, text) {
    setAiSuggestedValues((current) =>
      current.map((value, valueIndex) =>
        valueIndex === index ? { ...value, text, icon: value.icon || getValueIcon(text) } : value
      )
    );
    setPhase2SelectedValues((current) =>
      current.map((selected) => (selected === aiSuggestedValues[index]?.text ? text : selected))
    );
  }

  function removeAiSuggestedValue(index) {
    const removedText = aiSuggestedValues[index]?.text;
    setAiSuggestedValues((current) => current.filter((_, valueIndex) => valueIndex !== index));
    setPhase2SelectedValues((current) => current.filter((value) => value !== removedText));
  }

  function addAiSuggestedValue() {
    const text = cleanValueText(newAiValue);
    if (!text) return;
    setAiSuggestedValues((current) => [...current, normalizeAiValue({ text }, current.length)]);
    setNewAiValue("");
  }

  function moveSelectedValue(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= phase2SelectedValues.length) return;
    setPhase2SelectedValues((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function goToPhaseOneSummary() {
    setPhaseOneScreen("summary");
    void syncFullDraftForResearcher();
  }

  function completeCurrentToolAndContinue() {
    const otherTool = phaseOneVersion === "A" ? "B" : "A";
    const otherAlreadyCompleted = completedPhaseOneTools.includes(otherTool);

    let nextAValues = toolAValues;
    let nextBValues = toolBValues;

    if (phaseOneVersion === "A") {
      nextAValues = values.map((value) => value.trim()).filter(Boolean);
      setToolAValues(nextAValues);
      setToolAValueIcons([...valueIcons]);
      setToolAGoalData({ ...goalData });
    } else {
      nextBValues = versionBBoardItems
        .filter((item) => item.type === "text")
        .map((item) => item.text?.trim() || "")
        .filter(Boolean);
      setToolBValues(nextBValues);
      setToolBValueIcons((current) => nextBValues.map((value, index) => current[index] || getValueIcon(value)));
    }

    setCompletedPhaseOneTools((current) =>
      current.includes(phaseOneVersion) ? current : [...current, phaseOneVersion]
    );

    if (otherAlreadyCompleted) {
      goToPhaseOneSummary();
      return;
    }

    setPhaseOneVersion(otherTool);
    setPhaseOneScreen("questions");
    if (otherTool === "B") setVersionBQuestionIndex(0);
    if (otherTool === "A") setCurrentQuestion(0);
  }

  function togglePhase2ValueSelection(valueText) {
    setPhase2SelectedValues((current) => {
      if (current.includes(valueText)) return current.filter((value) => value !== valueText);
      if (current.length >= MAX_PHASE2_VALUES) return current;
      return [...current, valueText];
    });
  }

  function switchPhase(nextPhase) {
    setPhase(nextPhase);
    if (nextPhase === 2) {
      syncPhaseTwoDrawValues();
      setPhaseTwoScreen("tools");
    }
  }

  function switchToPhaseTwoFromSummary() {
    syncPhaseTwoDrawValues();
    setPhase(2);
    setPhaseTwoScreen("tools");
    void syncFullDraftForResearcher();
  }

  function startArtAndDrawingTool() {
    syncPhaseTwoDrawValues();
    setPhaseTwoScreen("shapes");
  }

  function startToolAVennDiagram() {
    syncPhaseTwoDrawValues();
    setPhaseTwoScreen("tool-a");
  }

  function startToolBPuzzle() {
    syncPhaseTwoDrawValues();
    setPhaseTwoScreen("tool-b");
  }

  function resolveDrawStore(drawStore) {
    return (
      drawStore || {
        canvasStatesRef,
        drawStartsRef,
        drawInteractRef,
        snapshotOnEnd: true
      }
    );
  }

  function updateVersionBDrawSetting(questionIndex, patch) {
    setVersionBDrawSettings((current) =>
      current.map((setting, settingIndex) => (settingIndex === questionIndex ? { ...setting, ...patch } : setting))
    );
    const canvasState = versionBCanvasStatesRef.current[questionIndex];
    if (!canvasState) return;
    if (patch.tool) canvasState.tool = patch.tool;
    if (patch.sticker) canvasState.sticker = patch.sticker;
    if (patch.colorIndex !== undefined) canvasState.color = COLORS[patch.colorIndex];
    if (patch.brushSize !== undefined) canvasState.brushSize = patch.brushSize;
  }

  function selectVersionBDrawSticker(questionIndex, emoji) {
    updateVersionBDrawSetting(questionIndex, { tool: "sticker", sticker: emoji });
    setVersionBDrawEmojiPickerIndex(null);
  }

  function clearVersionBDrawCanvas(questionIndex) {
    const canvasState = versionBCanvasStatesRef.current[questionIndex];
    if (!canvasState) return;
    canvasState.strokes = [];
    canvasState.shapes = [];
    canvasState.stickers = [];
    canvasState.selectedStickerIndex = null;
    canvasState.selectedObject = null;
    drawStoredCanvas(canvasState);
  }

  function saveVersionBDrawingFromCanvas(questionIndex) {
    const exported = exportCroppedPNG(versionBCanvasStatesRef.current[questionIndex]);
    if (!exported?.dataURL) return;
    setVersionBPhotos((current) =>
      current.map((photo, index) => {
        if (index !== questionIndex) return photo;
        releaseUploadedPhoto(photo);
        return { name: `drawing-q${questionIndex + 1}.png`, url: exported.dataURL, dataUrl: exported.dataURL };
      })
    );
  }

  function toggleVersionBPhotoPanel(panel) {
    setVersionBPhotoPanel((current) => (current === panel ? null : panel));
  }

  function versionBQuestionStickerSeed(questionIndex) {
    return questionIndex === 0 ? "🌟" : "😟";
  }

  function renderDrawingCanvasCard({
    index,
    setting,
    subtitle,
    stickerSeed,
    emojiPickerIndex,
    setEmojiPickerIndex,
    onUpdateSetting,
    onSelectSticker,
    onClear,
    canvasRefAssign,
    onDrawStart,
    onDrawMove,
    onDrawEnd
  }) {
    return (
      <div className="draw-card version-b-draw-card">
        <div className="draw-header">
          <div>
            {subtitle ? <div className="draw-subtitle">{subtitle}</div> : null}
          </div>
          <button className="small-button" type="button" onClick={onClear}>
            Clear
          </button>
        </div>

        <div className="toolbar">
          <button
            className={`tb-btn brush-tool-btn ${setting.tool === "free" ? "sel" : ""}`}
            type="button"
            aria-label="Use brush"
            onClick={() => onUpdateSetting({ tool: "free" })}
          >
            🖌
          </button>
          <div className="shape-tools">
            {SHAPE_LIST.filter((shape) => shape !== "free").map((shape) => (
              <button
                className={`tb-btn ${setting.tool === shape ? "sel" : ""}`}
                type="button"
                key={shape}
                onClick={() => onUpdateSetting({ tool: shape })}
              >
                {SHAPE_ICONS[shape]}
              </button>
            ))}
          </div>
          <div className="sticker-tools" aria-label="Sticker tools">
            {[stickerSeed, ...STICKER_OPTIONS.filter((sticker) => sticker !== stickerSeed)]
              .slice(0, INLINE_STICKER_COUNT)
              .map((sticker) => (
                <button
                  className={`sticker-btn ${setting.tool === "sticker" && setting.sticker === sticker ? "sel" : ""}`}
                  type="button"
                  key={sticker}
                  aria-label={`Use ${sticker} sticker`}
                  onClick={() => onSelectSticker(sticker)}
                >
                  {sticker}
                </button>
              ))}
            <span className="sticker-more-wrap">
              <button
                className={`sticker-more-btn ${emojiPickerIndex === index ? "sel" : ""}`}
                type="button"
                aria-label="Show more emoji stickers"
                aria-expanded={emojiPickerIndex === index}
                onClick={() => setEmojiPickerIndex((current) => (current === index ? null : index))}
              >
                More
              </button>
              {emojiPickerIndex === index ? (
                <ValueEmojiPicker
                  currentEmoji={setting.sticker || stickerSeed}
                  onSelect={onSelectSticker}
                  onClose={() => setEmojiPickerIndex(null)}
                />
              ) : null}
            </span>
          </div>
          <div className="color-tools">
            {COLORS.map((color, colorIndex) => (
              <button
                aria-label={`Use color ${color}`}
                className={`color-swatch ${setting.colorIndex === colorIndex ? "sel" : ""}`}
                key={color}
                style={{ background: color }}
                type="button"
                onClick={() => onUpdateSetting({ colorIndex })}
              />
            ))}
          </div>
          <div className="brush-row">
            <div className="brush-label-row">
              <span className="brush-label">Stroke</span>
              <span className="brush-value">{setting.brushSize}</span>
            </div>
            <input
              className="brush-input"
              type="range"
              min="2"
              max="40"
              value={setting.brushSize}
              onChange={(event) => onUpdateSetting({ brushSize: Number(event.target.value) })}
            />
          </div>
        </div>

        <canvas
          className="draw-cv"
          height="200"
          ref={canvasRefAssign}
          onMouseDown={(event) => onDrawStart(event, false)}
          onMouseMove={(event) => onDrawMove(event, false)}
          onMouseUp={(event) => onDrawEnd(event, false)}
          onMouseLeave={(event) => onDrawEnd(event, false)}
          onTouchStart={(event) => onDrawStart(event, true)}
          onTouchMove={(event) => onDrawMove(event, true)}
          onTouchEnd={(event) => onDrawEnd(event, true)}
        />
      </div>
    );
  }

  function updateCanvasSetting(index, patch) {
    setDrawSettings((current) =>
      current.map((setting, settingIndex) => (settingIndex === index ? { ...setting, ...patch } : setting))
    );
    const canvasState = canvasStatesRef.current[index];
    if (!canvasState) return;
    if (patch.tool) canvasState.tool = patch.tool;
    if (patch.sticker) canvasState.sticker = patch.sticker;
    if (patch.colorIndex !== undefined) canvasState.color = COLORS[patch.colorIndex];
    if (patch.brushSize !== undefined) canvasState.brushSize = patch.brushSize;
  }

  function selectCanvasSticker(index, emoji) {
    updateCanvasSetting(index, { tool: "sticker", sticker: emoji });
    setDrawEmojiPickerIndex(null);
  }

  function clearCanvas(index) {
    const canvasState = canvasStatesRef.current[index];
    if (!canvasState) return;
    canvasState.strokes = [];
    canvasState.shapes = [];
    canvasState.stickers = [];
    canvasState.selectedStickerIndex = null;
    canvasState.selectedObject = null;
    drawStoredCanvas(canvasState);
  }

  function handleDrawStart(index, event, useTouch = false, drawStore) {
    event.preventDefault();
    const { canvasStatesRef: statesRef, drawStartsRef: startsRef, drawInteractRef: interactRef } =
      resolveDrawStore(drawStore);
    const canvasState = statesRef.current[index];
    if (!canvasState) return;
    const point = getPoint(canvasState.cv, event, useTouch);
    const hadSelection = Number.isInteger(canvasState.selectedStickerIndex) || Boolean(canvasState.selectedObject);

    if (Number.isInteger(canvasState.selectedStickerIndex)) {
      const selectedSticker = canvasState.stickers[canvasState.selectedStickerIndex];
      const handle = selectedSticker ? hitStickerHandle(selectedSticker, point.x, point.y) : null;
      if (handle === "delete") {
        canvasState.stickers.splice(canvasState.selectedStickerIndex, 1);
        canvasState.selectedStickerIndex = null;
        canvasState.selectedObject = null;
        drawStoredCanvas(canvasState);
        return;
      }
      if (handle === "resize" || handle === "rotate") {
        interactRef.current = {
          mode: handle,
          index,
          stickerIndex: canvasState.selectedStickerIndex,
          startX: point.x,
          startY: point.y,
          startSize: selectedSticker.size,
          startRotation: selectedSticker.rotation || 0
        };
        return;
      }
    }

    for (let stickerIndex = canvasState.stickers.length - 1; stickerIndex >= 0; stickerIndex -= 1) {
      const sticker = canvasState.stickers[stickerIndex];
      if (hitSticker(sticker, point.x, point.y)) {
        canvasState.selectedStickerIndex = stickerIndex;
        canvasState.selectedObject = null;
        interactRef.current = {
          mode: "move",
          index,
          stickerIndex,
          startX: point.x,
          startY: point.y,
          originalX: sticker.x,
          originalY: sticker.y
        };
        drawStoredCanvas(canvasState);
        return;
      }
    }

    for (let shapeIndex = canvasState.shapes.length - 1; shapeIndex >= 0; shapeIndex -= 1) {
      const shape = canvasState.shapes[shapeIndex];
      const handle = canvasState.selectedObject?.type === "shape" && canvasState.selectedObject.index === shapeIndex
        ? hitShapeHandle(shape, point.x, point.y)
        : null;
      if (handle === "delete-shape") {
        canvasState.shapes.splice(shapeIndex, 1);
        canvasState.selectedObject = null;
        canvasState.selectedStickerIndex = null;
        drawStoredCanvas(canvasState);
        return;
      }
      if (handle === "resize-shape" || handle === "rotate-shape") {
        canvasState.selectedStickerIndex = null;
        canvasState.selectedObject = { type: "shape", index: shapeIndex };
        interactRef.current = {
          mode: handle,
          index,
          objectIndex: shapeIndex,
          startX: point.x,
          startY: point.y,
          startR: shape.r,
          startRotation: shape.rotation || 0
        };
        return;
      }
      if (hitShape(shape, point.x, point.y)) {
        canvasState.selectedStickerIndex = null;
        canvasState.selectedObject = { type: "shape", index: shapeIndex };
        interactRef.current = {
          mode: "move-object",
          index,
          objectType: "shape",
          objectIndex: shapeIndex,
          startX: point.x,
          startY: point.y,
          originalCx: shape.cx,
          originalCy: shape.cy
        };
        drawStoredCanvas(canvasState);
        return;
      }
    }

    for (let strokeIndex = canvasState.strokes.length - 1; strokeIndex >= 0; strokeIndex -= 1) {
      const stroke = canvasState.strokes[strokeIndex];
      if (hitStroke(stroke, point.x, point.y)) {
        canvasState.selectedStickerIndex = null;
        canvasState.selectedObject = { type: "stroke", index: strokeIndex };
        interactRef.current = {
          mode: "move-object",
          index,
          objectType: "stroke",
          objectIndex: strokeIndex,
          startX: point.x,
          startY: point.y,
          originalPts: stroke.pts.map((pt) => ({ ...pt }))
        };
        drawStoredCanvas(canvasState);
        return;
      }
    }

    if (hadSelection) {
      canvasState.selectedStickerIndex = null;
      canvasState.selectedObject = null;
      drawStoredCanvas(canvasState);
      return;
    }

    if (canvasState.tool === "sticker") {
      canvasState.stickers.push({
        emoji: canvasState.sticker || STICKER_OPTIONS[0],
        x: point.x,
        y: point.y,
        size: Math.max(30, canvasState.brushSize + 22),
        rotation: 0
      });
      canvasState.selectedStickerIndex = canvasState.stickers.length - 1;
      canvasState.selectedObject = null;
      drawStoredCanvas(canvasState);
      return;
    }
    canvasState.selectedStickerIndex = null;
    canvasState.selectedObject = null;
    if (canvasState.tool !== "free" && !SHAPE_LIST.includes(canvasState.tool)) {
      drawStoredCanvas(canvasState);
      return;
    }
    canvasState.drawing = true;
    startsRef.current[index] = point;
    if (canvasState.tool === "free") {
      canvasState.strokes.push({
        color: canvasState.color,
        w: canvasState.brushSize,
        pts: [{ x: point.x, y: point.y }]
      });
    }
  }

  function handleDrawMove(index, event, useTouch = false, drawStore) {
    event.preventDefault();
    const { canvasStatesRef: statesRef, drawStartsRef: startsRef, drawInteractRef: interactRef } =
      resolveDrawStore(drawStore);
    const canvasState = statesRef.current[index];
    if (!canvasState) return;
    const point = getPoint(canvasState.cv, event, useTouch);

    const interaction = interactRef.current;
    if (interaction?.index === index && ["move", "resize", "rotate"].includes(interaction.mode)) {
      const sticker = canvasState.stickers[interaction.stickerIndex];
      if (!sticker) return;
      if (interaction.mode === "move") {
        sticker.x = interaction.originalX + (point.x - interaction.startX);
        sticker.y = interaction.originalY + (point.y - interaction.startY);
      } else if (interaction.mode === "resize") {
        const startDistance = Math.hypot(interaction.startX - sticker.x, interaction.startY - sticker.y);
        const nextDistance = Math.hypot(point.x - sticker.x, point.y - sticker.y);
        if (startDistance > 0) sticker.size = Math.max(18, Math.min(120, interaction.startSize * (nextDistance / startDistance)));
      } else if (interaction.mode === "rotate") {
        sticker.rotation =
          interaction.startRotation +
          (Math.atan2(point.y - sticker.y, point.x - sticker.x) -
            Math.atan2(interaction.startY - sticker.y, interaction.startX - sticker.x));
      }
      drawStoredCanvas(canvasState);
      return;
    }

    if (interaction?.index === index && interaction.mode === "move-object") {
      const dx = point.x - interaction.startX;
      const dy = point.y - interaction.startY;
      if (interaction.objectType === "shape") {
        const shape = canvasState.shapes[interaction.objectIndex];
        if (!shape) return;
        shape.cx = interaction.originalCx + dx;
        shape.cy = interaction.originalCy + dy;
      } else if (interaction.objectType === "stroke") {
        const stroke = canvasState.strokes[interaction.objectIndex];
        if (!stroke) return;
        stroke.pts = interaction.originalPts.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
      }
      drawStoredCanvas(canvasState);
      return;
    }

    if (interaction?.index === index && ["resize-shape", "rotate-shape"].includes(interaction.mode)) {
      const shape = canvasState.shapes[interaction.objectIndex];
      if (!shape) return;
      if (interaction.mode === "resize-shape") {
        const startDistance = Math.hypot(interaction.startX - shape.cx, interaction.startY - shape.cy);
        const nextDistance = Math.hypot(point.x - shape.cx, point.y - shape.cy);
        if (startDistance > 0) shape.r = Math.max(10, Math.min(120, interaction.startR * (nextDistance / startDistance)));
      } else {
        shape.rotation =
          interaction.startRotation +
          (Math.atan2(point.y - shape.cy, point.x - shape.cx) -
            Math.atan2(interaction.startY - shape.cy, interaction.startX - shape.cx));
      }
      drawStoredCanvas(canvasState);
      return;
    }

    if (!canvasState.drawing) return;
    if (canvasState.tool === "free") {
      canvasState.strokes[canvasState.strokes.length - 1].pts.push({ x: point.x, y: point.y });
      drawStoredCanvas(canvasState);
      return;
    }
    const start = startsRef.current[index];
    drawStoredCanvas(canvasState);
    canvasState.ctx.fillStyle = canvasState.color;
    drawShapeCtx(
      canvasState.ctx,
      canvasState.tool,
      (start.x + point.x) / 2,
      (start.y + point.y) / 2,
      Math.max(12, Math.hypot(point.x - start.x, point.y - start.y) / 2)
    );
  }

  function handleDrawEnd(index, event, useTouch = false, drawStore) {
    const { canvasStatesRef: statesRef, drawStartsRef: startsRef, drawInteractRef: interactRef, snapshotOnEnd } =
      resolveDrawStore(drawStore);
    const canvasState = statesRef.current[index];
    if (interactRef.current?.index === index) {
      interactRef.current = null;
      return;
    }
    if (!canvasState?.drawing) return;
    canvasState.drawing = false;
    if (canvasState.tool === "free") {
      if (snapshotOnEnd) snapshotPerValueDrawings();
      return;
    }

    const start = startsRef.current[index];
    const point = getPoint(canvasState.cv, event, useTouch);
    canvasState.shapes.push({
      type: canvasState.tool,
      cx: (start.x + point.x) / 2,
      cy: (start.y + point.y) / 2,
      r: Math.max(12, Math.hypot(point.x - start.x, point.y - start.y) / 2),
      color: canvasState.color,
      rotation: 0
    });
    drawStoredCanvas(canvasState);
    if (snapshotOnEnd) snapshotPerValueDrawings();
  }

  function renderLegend() {
    setLegendThumbs(
      drawValues.map((_, index) => {
        const canvasState = canvasStatesRef.current[index];
        const exported = exportCroppedPNG(canvasState);
        if (!exported) return "";
        const scale = 40 / Math.max(exported.w, exported.h);
        const width = Math.round(exported.w * scale);
        const height = Math.round(exported.h * scale);
        const thumb = document.createElement("canvas");
        thumb.width = 44;
        thumb.height = 44;
        const ctx = thumb.getContext("2d");
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, 44, 44);
          ctx.drawImage(img, (44 - width) / 2, (44 - height) / 2, width, height);
          setLegendThumbs((current) => current.map((src, srcIndex) => (srcIndex === index ? thumb.toDataURL() : src)));
        };
        img.src = exported.dataURL;
        return "";
      })
    );
  }

  function showComposite() {
    snapshotPerValueDrawings();
    const items = drawValues.map((valueName, index) => {
      const canvasState = canvasStatesRef.current[index];
      const exported = exportCroppedPNG(canvasState);
      const position = getCompositeItemPosition(index, drawValues.length);
      const targetSize = drawValues.length > 3 ? 92 : 120;
      if (!exported) {
        return {
          img: null,
          natW: targetSize,
          natH: targetSize,
          x: position.x,
          y: position.y,
          scale: 1,
          rotation: 0,
          valueIdx: index,
          valueName: canvasState?.valueName || valueName,
          placeholder: true
        };
      }

      const item = {
        img: null,
        natW: exported.w,
        natH: exported.h,
        x: position.x,
        y: position.y,
        scale: targetSize / Math.max(exported.w, exported.h),
        rotation: 0,
        valueIdx: index,
        valueName: canvasState.valueName || valueName
      };
      const img = new Image();
      img.onload = () => {
        item.img = img;
        drawComposite();
      };
      img.src = exported.dataURL;
      return item;
    });

    compositeItemsRef.current = items;
    selectedIdxRef.current = null;
    interactModeRef.current = null;
    compositeStrokesRef.current = [];
    compositeActiveStrokeRef.current = null;
    setCompositeDrawTool("brush");
    renderLegend();
    setPhaseTwoScreen("composite");
    appendSessionEvent({ type: "phase_two_screen", screen: "composite" });
    forceCompositeDraw((current) => current + 1);
  }

  function showStakeholderCombine() {
    snapshotPerValueDrawings();
    selectedIdxRef.current = null;
    drawComposite();
    const myComponents = drawValues.map((valueName, index) => {
      const canvasState = canvasStatesRef.current[index];
      const exported = exportCroppedPNG(canvasState);
      const fallback = exported || makeMockComponentPNG({ shape: "circle" }, COLORS[index % COLORS.length], index);
      return {
        id: `youth-${index}`,
        owner: "youth",
        ownerLabel: "My values",
        label: valueName || canvasState?.valueName || `Value ${index + 1}`,
        src: fallback.dataURL,
        w: fallback.w,
        h: fallback.h
      };
    });
    const stakeholderComponents = STAKEHOLDER_COMPONENT_SETS.flatMap((set) =>
      set.components.map((component, index) => {
        const png = makeMockComponentPNG(component, set.color, index);
        return {
          id: `${set.role}-${index}`,
          owner: set.role,
          ownerLabel: `${set.label} values`,
          label: component.label,
          src: png.dataURL,
          w: png.w,
          h: png.h
        };
      })
    );
    setComponentTray([...myComponents, ...stakeholderComponents]);
    setPlacedComponents([]);
    setSelectedPlacedId(null);
    sharedStrokesRef.current = [];
    sharedActiveStrokeRef.current = null;
    setSharedDrawTool("select");
    forceSharedDraw((current) => current + 1);
    setPhaseTwoScreen("stakeholders");
    appendSessionEvent({ type: "phase_two_screen", screen: "stakeholders" });
  }

  function startComponentDrag(event, payload) {
    dragPayloadRef.current = payload;
    if (payload.source === "placed") setSelectedPlacedId(payload.instanceId);
    if (payload.source === "placed" || payload.source === "tray") setSharedDrawTool("select");
    event.dataTransfer.effectAllowed = "copyMove";
    event.dataTransfer.setData("text/plain", payload.id);
  }

  function getBoardDropPoint(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(24, Math.min(rect.width - 24, event.clientX - rect.left)),
      y: Math.max(24, Math.min(rect.height - 24, event.clientY - rect.top))
    };
  }

  function getSharedDrawPoint(event, useTouch = false) {
    const canvas = sharedCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const source = useTouch ? event.touches[0] || event.changedTouches[0] : event;
    return {
      x: (source.clientX - rect.left) * (canvas.width / rect.width),
      y: (source.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function getSharedBoardPoint(event, useTouch = false) {
    const canvas = sharedCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const source = useTouch ? event.touches[0] || event.changedTouches[0] : event;
    return {
      x: source.clientX - rect.left,
      y: source.clientY - rect.top
    };
  }

  function hitPlacedComponent(component, point) {
    const size = 96 * component.scale;
    const half = size / 2;
    const dx = point.x - component.x;
    const dy = point.y - component.y;
    const rotation = (component.rotation * Math.PI) / 180;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const localX = cos * dx - sin * dy;
    const localY = sin * dx + cos * dy;
    return Math.abs(localX) <= half && Math.abs(localY) <= half;
  }

  function getPlacedComponentAtPoint(point) {
    for (let index = placedComponents.length - 1; index >= 0; index -= 1) {
      const component = placedComponents[index];
      if (hitPlacedComponent(component, point)) return component;
    }
    return null;
  }

  function getPlacedComponentFromScreenPoint(event, useTouch = false) {
    const source = useTouch ? event.touches[0] || event.changedTouches[0] : event;
    const elements = document.elementsFromPoint(source.clientX, source.clientY);
    const placedElement = elements
      .map((element) => element.closest?.(".placed-component"))
      .find(Boolean);
    if (!placedElement) return null;
    return placedComponents.find((component) => component.instanceId === placedElement.dataset.instanceId) || null;
  }

  function handleSharedDrawStart(event, useTouch = false) {
    if (sharedDrawTool === "select") return;
    event.preventDefault();
    const canvas = sharedCanvasRef.current;
    if (!canvas) return;
    const boardPoint = getSharedBoardPoint(event, useTouch);
    const hitComponent = getPlacedComponentFromScreenPoint(event, useTouch) || getPlacedComponentAtPoint(boardPoint);
    if (hitComponent) {
      sharedActiveStrokeRef.current = null;
      setSelectedPlacedId(hitComponent.instanceId);
      setSharedDrawTool("select");
      return;
    }
    if (selectedPlacedId) {
      sharedActiveStrokeRef.current = null;
      setSelectedPlacedId(null);
      return;
    }
    const point = getSharedDrawPoint(event, useTouch);
    const stroke = {
      tool: sharedDrawTool,
      color: COLORS[sharedBrushColorIndex],
      width: sharedDrawTool === "eraser" ? sharedBrushSize * 2.4 : sharedBrushSize,
      pts: [point]
    };
    sharedActiveStrokeRef.current = stroke;
    sharedStrokesRef.current.push(stroke);
  }

  function handleSharedDrawMove(event, useTouch = false) {
    event.preventDefault();
    const stroke = sharedActiveStrokeRef.current;
    if (!stroke) return;
    stroke.pts.push(getSharedDrawPoint(event, useTouch));
    drawSharedCanvas();
  }

  function handleSharedDrawEnd() {
    if (sharedActiveStrokeRef.current) forceSharedDraw((current) => current + 1);
    sharedActiveStrokeRef.current = null;
  }

  function undoSharedDrawing() {
    sharedStrokesRef.current.pop();
    drawSharedCanvas();
    forceSharedDraw((current) => current + 1);
  }

  function getCompositeDrawPoint(event, useTouch = false) {
    const canvas = compositeDrawCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const source = useTouch ? event.touches[0] || event.changedTouches[0] : event;
    return {
      x: (source.clientX - rect.left) * (canvas.width / rect.width),
      y: (source.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function compositePointHitsItem(point) {
    const selectedIdx = selectedIdxRef.current;
    if (selectedIdx !== null) {
      const selected = compositeItemsRef.current[selectedIdx];
      if (selected && hitHandle(selected, point.x, point.y)) return true;
    }
    return compositeItemsRef.current.some((item) => hitItem(item, point.x, point.y));
  }

  function handleCompositeDrawStart(event, useTouch = false) {
    event.preventDefault();
    event.stopPropagation();
    const point = getCompositeDrawPoint(event, useTouch);
    if (compositePointHitsItem(point)) {
      compositeActiveStrokeRef.current = null;
      handleCompositeStart(event, useTouch);
      return;
    }
    if (selectedIdxRef.current !== null) {
      selectedIdxRef.current = null;
      interactModeRef.current = null;
      drawComposite();
      return;
    }
    const stroke = {
      tool: compositeDrawTool,
      color: COLORS[compositeBrushColorIndex],
      width: compositeDrawTool === "eraser" ? compositeBrushSize * 2.4 : compositeBrushSize,
      pts: [point]
    };
    compositeActiveStrokeRef.current = stroke;
    compositeStrokesRef.current.push(stroke);
  }

  function handleCompositeDrawMove(event, useTouch = false) {
    if (interactModeRef.current) {
      handleCompositeMove(event, useTouch);
      return;
    }
    const stroke = compositeActiveStrokeRef.current;
    if (!stroke) return;
    event.preventDefault();
    event.stopPropagation();
    stroke.pts.push(getCompositeDrawPoint(event, useTouch));
    drawCompositeOverlay();
  }

  function handleCompositeDrawEnd() {
    if (interactModeRef.current) {
      handleCompositeEnd();
      return;
    }
    compositeActiveStrokeRef.current = null;
  }

  function undoCompositeDrawing() {
    compositeStrokesRef.current.pop();
    drawCompositeOverlay();
    forceCompositeDraw((current) => current + 1);
  }

  function handleBoardDrop(event) {
    event.preventDefault();
    const payload = dragPayloadRef.current;
    if (!payload) return;
    const point = getBoardDropPoint(event);

    if (payload.source === "placed") {
      setPlacedComponents((current) =>
        current.map((component) =>
          component.instanceId === payload.instanceId ? { ...component, x: point.x, y: point.y } : component
        )
      );
    } else {
      const instanceId = `${payload.component.id}-${Date.now()}`;
      setPlacedComponents((current) => [
        ...current,
        {
          ...payload.component,
          instanceId,
          x: point.x,
          y: point.y,
          scale: 1,
          rotation: 0
        }
      ]);
      setSelectedPlacedId(instanceId);
    }
    setSharedDrawTool("select");
    dragPayloadRef.current = null;
  }

  function selectPlacedValue(event, instanceId) {
    event.stopPropagation();
    setSharedDrawTool("select");
    setSelectedPlacedId(instanceId);
  }

  function rotatePlacedComponent(instanceId) {
    setPlacedComponents((current) =>
      current.map((component) =>
        component.instanceId === instanceId ? { ...component, rotation: component.rotation + 15 } : component
      )
    );
  }

  function startValueResize(event, component) {
    event.preventDefault();
    event.stopPropagation();
    valueResizeRef.current = {
      instanceId: component.instanceId,
      startX: event.touches?.[0]?.clientX ?? event.clientX,
      startScale: component.scale
    };
  }

  function removePlacedComponent(instanceId) {
    setPlacedComponents((current) => current.filter((component) => component.instanceId !== instanceId));
    setSelectedPlacedId((current) => (current === instanceId ? null : current));
  }

  function handleCompositeStart(event, useTouch = false) {
    event.preventDefault();
    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const point = getCompositePoint(canvas, event, useTouch);
    const selectedIdx = selectedIdxRef.current;

    if (selectedIdx !== null) {
      const selected = compositeItemsRef.current[selectedIdx];
      const handle = hitHandle(selected, point.x, point.y);
      if (handle === "delete") {
        compositeItemsRef.current.splice(selectedIdx, 1);
        selectedIdxRef.current = null;
        drawComposite();
        return;
      }
      if (handle === "resize") {
        interactModeRef.current = "resize";
        interactStartRef.current = { mx: point.x, my: point.y, os: selected.scale };
        return;
      }
      if (handle === "rotate") {
        interactModeRef.current = "rotate";
        interactStartRef.current = { mx: point.x, my: point.y, or: selected.rotation };
        return;
      }
    }

    for (let index = compositeItemsRef.current.length - 1; index >= 0; index -= 1) {
      const item = compositeItemsRef.current[index];
      if (hitItem(item, point.x, point.y)) {
        selectedIdxRef.current = index;
        interactModeRef.current = "move";
        interactStartRef.current = { mx: point.x, my: point.y, ox: item.x, oy: item.y };
        drawComposite();
        return;
      }
    }

    selectedIdxRef.current = null;
    interactModeRef.current = null;
    drawComposite();
  }

  function handleCompositeMove(event, useTouch = false) {
    event.preventDefault();
    const selectedIdx = selectedIdxRef.current;
    const mode = interactModeRef.current;
    if (!mode || selectedIdx === null) return;

    const canvas = compositeCanvasRef.current;
    const point = getCompositePoint(canvas, event, useTouch);
    const item = compositeItemsRef.current[selectedIdx];
    const start = interactStartRef.current;

    if (mode === "move") {
      item.x = start.ox + (point.x - start.mx);
      item.y = start.oy + (point.y - start.my);
    } else if (mode === "resize") {
      const newDistance = Math.hypot(point.x - item.x, point.y - item.y);
      const startDistance = Math.hypot(start.mx - item.x, start.my - item.y);
      if (startDistance > 0) item.scale = Math.max(0.1, start.os * (newDistance / startDistance));
    } else if (mode === "rotate") {
      item.rotation =
        start.or +
        (Math.atan2(point.y - item.y, point.x - item.x) - Math.atan2(start.my - item.y, start.mx - item.x));
    }

    drawComposite();
  }

  function handleCompositeEnd() {
    interactModeRef.current = null;
  }

  function toggleShareTarget(target) {
    setShareTargets((current) => ({ ...current, [target]: !current[target] }));
  }

  function updateParticipantSessionId(value) {
    const nextId = value.trim();
    setParticipantSessionId(nextId);
    setResearcherSessionLookup(nextId);
  }

  function continueFromParticipantIntro() {
    if (!participantSessionId.trim()) return;
    if (participantPassword.trim() !== PARTICIPANT_ACCESS_PASSWORD) {
      setParticipantPasswordError("Incorrect password. Please enter the password provided by the researcher.");
      return;
    }
    setParticipantPasswordError("");
    const savedDraft = readParticipantSessionDraft(participantSessionId);
    if (savedDraft) {
      applyParticipantSession(savedDraft, { screen: savedDraft.phaseOne?.currentScreen || "questions" });
      return;
    }
    setParticipantIntroComplete(true);
  }

  if (researcherMode) {
    void researcherDraftTick;
    const loadedDraft = readParticipantSessionDraft(researcherSessionLookup);
    const phase1Complete =
      loadedDraft?.phaseOne?.completedTools?.length === 2 ||
      loadedDraft?.phaseOne?.currentScreen === "summary" ||
      (loadedDraft?.phase || 1) >= 2;
    const phase2Ready = Boolean(loadedDraft?.participantFinished || loadedDraft?.phase === 2);
    const phase1SavedAt = loadedDraft?.checkpoints?.phase1?.savedAt;
    const phase2SavedAt = loadedDraft?.checkpoints?.phase2?.savedAt;

    return (
      <div className="app researcher-app">
        <h1 className="researcher-title">Researcher Tools</h1>

        <p className="researcher-api-ok">
          Data stays in this browser until the researcher downloads JSON files. Nothing is saved to GitHub Pages.
        </p>

        <section className="researcher-card researcher-participant-bar">
          <div className="researcher-row">
            <label className="researcher-label">
              Participant ID
              <input
                type="text"
                value={researcherSessionLookup}
                placeholder="P1"
                onChange={(event) => setResearcherSessionLookup(event.target.value.trim())}
              />
            </label>
            <button type="button" onClick={loadParticipantDraftForResearcher}>
              Load draft
            </button>
          </div>
          {loadedDraft ? (
            <p className="researcher-draft-summary">
              {researcherSessionLookup}: Phase {loadedDraft.phase || 1}
              {loadedDraft.phase === 2 ? ` · ${loadedDraft.phaseTwo?.currentScreen || "tools"}` : ` · ${loadedDraft.phaseOne?.currentScreen || "questions"}`}
              {loadedDraft.participantFinished ? " · participant finished" : ""}
            </p>
          ) : (
            <p className="researcher-draft-summary">
              No local draft for {researcherSessionLookup || "this ID"}. The participant must use this browser/profile,
              with the same participant ID.
            </p>
          )}
        </section>

        <section className="researcher-card researcher-workflow-card">
          <h2>Phase 1 — Update participant values with AI</h2>
          <p className="researcher-subtitle">
            Export question responses for the hospital AI, then paste the AI JSON back to update participant values.
          </p>

          <div className="researcher-workflow-step">
            <div className="researcher-step-label">Step 1 — Export responses for AI</div>
            <p>Download question responses as JSON and paste them into the hospital AI system.</p>
            <label className="researcher-label researcher-tool-select">
              Tool
              <select value={researcherExportTool} onChange={(event) => setResearcherExportTool(event.target.value)}>
                <option value="A">Tool A</option>
                <option value="B">Tool B</option>
              </select>
            </label>
            <button
              className="primary"
              type="button"
              disabled={!cleanValueText(researcherSessionLookup)}
              onClick={() => exportParticipantResponses()}
            >
              Download Tool {researcherExportTool} JSON
            </button>
          </div>

          <div className="researcher-workflow-step">
            <div className="researcher-step-label">Step 2 — Paste AI response and update participant values</div>
            <p>Paste the JSON returned from the hospital AI system. The participant&apos;s values screen will update automatically.</p>
            <label className="researcher-label researcher-tool-select">
              Tool
              <select value={researcherImportTool} onChange={(event) => setResearcherImportTool(event.target.value)}>
                <option value="A">Tool A</option>
                <option value="B">Tool B</option>
              </select>
            </label>
            <label className="researcher-file-drop">
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  importAiValuesFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              Upload AI JSON file
            </label>
            <div className="researcher-paste-box">
              <label className="researcher-label">
                Or paste AI JSON
                <textarea
                  className="researcher-json-paste"
                  value={researcherJsonPaste}
                  placeholder='{"sessionId":"P1","tool":"A","values":[{"text":"Staying healthy and strong","rationale":"..."}]}'
                  onChange={(event) => setResearcherJsonPaste(event.target.value)}
                />
              </label>
              <button type="button" disabled={!researcherJsonPaste.trim()} onClick={importPastedAiValues}>
                Update participant values
              </button>
            </div>
            {aiSuggestedValues.length > 0 ? (
              <div className="researcher-value-list">
                {aiSuggestedValues.map((value) => (
                  <div className="researcher-value-chip" key={value.id}>
                    <span>{value.icon || getValueIcon(value.text)}</span>
                    <strong>{value.text}</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="researcher-card researcher-workflow-card">
          <h2>Session log data</h2>
          <p className="researcher-subtitle">
            Session logs are downloaded directly to the researcher&apos;s computer. Tool C PNG data is embedded in the
            downloaded JSON, not stored on the publishing platform.
          </p>

          {!loadedDraft ? (
            <p>Load a participant draft above first.</p>
          ) : (
            <div className="log-data-panel">
              <div className="log-data-row">
                <div className="log-data-info">
                  <div className="log-data-title">Phase 1 log data</div>
                  <p className="log-data-desc">Questions, values, goals, and AI updates through Phase 1.</p>
                  {phase1SavedAt ? (
                    <span className="log-data-saved">Saved {new Date(phase1SavedAt).toLocaleString()}</span>
                  ) : (
                    <span className="log-data-saved log-data-saved--pending">Not saved yet</span>
                  )}
                </div>
                <div className="log-data-actions">
                  <button
                    className="primary"
                    type="button"
                    disabled={!phase1Complete}
                    onClick={() => savePhase1CheckpointAsResearcher()}
                  >
                    Save &amp; download
                  </button>
                  <button type="button" disabled={!phase1Complete} onClick={() => downloadPhase1LogData()}>
                    Download only
                  </button>
                </div>
              </div>

              <div className="log-data-row">
                <div className="log-data-info">
                  <div className="log-data-title">Phase 2 log data</div>
                  <p className="log-data-desc">Full session JSON with embedded Tool C PNG data.</p>
                  {phase2SavedAt ? (
                    <span className="log-data-saved">Saved {new Date(phase2SavedAt).toLocaleString()}</span>
                  ) : (
                    <span className="log-data-saved log-data-saved--pending">Not saved yet</span>
                  )}
                </div>
                <div className="log-data-actions">
                  <button
                    className="primary"
                    type="button"
                    disabled={!phase2Ready}
                    onClick={() => savePhase2CheckpointAsResearcher()}
                  >
                    Save &amp; download
                  </button>
                  <button type="button" disabled={!phase2Ready} onClick={() => downloadPhase2LogData()}>
                    Download only
                  </button>
                </div>
              </div>

              {loadedDraft.phaseTwo?.toolC?.perValueDrawings?.length ||
              loadedDraft.phaseTwo?.toolC?.composite?.finalImage ||
              loadedDraft.phaseTwo?.toolC?.stakeholders?.finalImage ? (
                <div className="log-data-images">
                  <div className="log-data-title">Tool C images (PNG)</div>
                  <p className="log-data-desc">
                    Previewed from the local draft. These images download as embedded PNG data in the Phase 2 JSON.
                  </p>
                  <div className="log-data-image-grid">
                    {(loadedDraft.phaseTwo.toolC.perValueDrawings || []).map((drawing, index) => {
                      const src = getToolCPreviewSrc(researcherSessionLookup, drawing);
                      if (!src) return null;
                      return (
                        <figure className="log-data-image-card" key={`value-${index}`}>
                          <img src={src} alt={drawing.valueName || `Value ${index + 1}`} />
                          <figcaption>{drawing.file || drawing.valueName || `Value ${index + 1}`}</figcaption>
                        </figure>
                      );
                    })}
                    {loadedDraft.phaseTwo.toolC.composite?.finalImage ? (
                      <figure className="log-data-image-card">
                        <img
                          src={getToolCPreviewSrc(researcherSessionLookup, loadedDraft.phaseTwo.toolC.composite.finalImage)}
                          alt="Composite"
                        />
                        <figcaption>{loadedDraft.phaseTwo.toolC.composite.finalImage.file || "composite.png"}</figcaption>
                      </figure>
                    ) : null}
                    {loadedDraft.phaseTwo.toolC.stakeholders?.finalImage ? (
                      <figure className="log-data-image-card">
                        <img
                          src={getToolCPreviewSrc(researcherSessionLookup, loadedDraft.phaseTwo.toolC.stakeholders.finalImage)}
                          alt="Stakeholders"
                        />
                        <figcaption>
                          {loadedDraft.phaseTwo.toolC.stakeholders.finalImage.file || "stakeholders.png"}
                        </figcaption>
                      </figure>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={() => {
            window.history.pushState({}, "", getParticipantPath());
            window.location.reload();
          }}
        >
          Open participant app
        </button>

        {researcherStatus ? <p className="researcher-status">{researcherStatus}</p> : null}
      </div>
    );
  }

  return (
    <div className="app">
      <h2 className="sr-only">Value elicitation and visualization tool</h2>
      {!participantIntroComplete ? (
        <div className="participant-id-card participant-id-card--intro">
          <div>
            <h1 className="participant-id-title">Before we start</h1>
            <p className="participant-id-subtitle">
              Enter the participant ID and password assigned by the researcher.
            </p>
          </div>
          <label className="participant-id-label">
            Participant ID
            <input
              type="text"
              value={participantSessionId}
              placeholder="P1"
              onChange={(event) => updateParticipantSessionId(event.target.value)}
              autoFocus
            />
          </label>
          <label className="participant-id-label">
            Password
            <input
              type="password"
              value={participantPassword}
              placeholder="Enter password"
              autoComplete="off"
              onChange={(event) => {
                setParticipantPassword(event.target.value);
                if (participantPasswordError) setParticipantPasswordError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") continueFromParticipantIntro();
              }}
            />
          </label>
          {participantPasswordError ? (
            <p className="participant-id-error" role="alert">
              {participantPasswordError}
            </p>
          ) : null}
          <div className="participant-id-actions">
            <button
              type="button"
              onClick={() => {
                window.history.pushState({}, "", getResearcherPath());
                window.location.reload();
              }}
            >
              Researcher dashboard
            </button>
            <button
              className="primary"
              type="button"
              disabled={!participantSessionId.trim() || !participantPassword.trim()}
              onClick={continueFromParticipantIntro}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
      {participantIntroComplete ? (
      <>
      <div className="participant-sync-bar">
        <span>
          ID: <strong>{participantSessionId}</strong>
        </span>
        {participantSyncStatus ? <span className="participant-sync-status">{participantSyncStatus}</span> : null}
      </div>
      <div className="phase-tabs">
        <div className="phase-tab-list" role="tablist" aria-label="Workflow phase">
          <button
            id="tab-phase-1"
            type="button"
            role="tab"
            aria-selected={phase === 1}
            aria-controls="panel-phase-1"
            className={`phase-tab ${phase === 1 ? "active" : ""}`}
            onClick={() => switchPhase(1)}
          >
            Phase 1 — Elicit values
          </button>
          <button
            id="tab-phase-2"
            type="button"
            role="tab"
            aria-selected={phase === 2}
            aria-controls="panel-phase-2"
            className={`phase-tab ${phase === 2 ? "active" : ""}`}
            onClick={() => switchPhase(2)}
          >
            Phase 2 — Visualize values
          </button>
        </div>
        {phase === 1 ? (
          <div className="phase1-version-under-tab">
            <div className="phase1-step-indicator" aria-label="Phase 1 progress">
              {phaseOneToolOrder.map((tool, index) => (
                <span className="phase1-step-group" key={tool}>
                  {index > 0 ? (
                    <span className="phase1-step-sep" aria-hidden="true">
                      →
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className={`phase1-step ${getPhaseOneToolStepState(tool)}`}
                    aria-current={phaseOneVersion === tool && phaseOneScreen !== "summary" ? "step" : undefined}
                    onClick={() => switchPhaseOneTool(tool)}
                  >
                    Tool {tool}
                  </button>
                </span>
              ))}
              <span className="phase1-step-sep" aria-hidden="true">
                →
              </span>
              <span
                className={`phase1-step ${
                  phaseOneScreen === "summary" ? "active" : completedPhaseOneTools.length === 2 ? "done" : ""
                }`}
              >
                Summary
              </span>
            </div>
            <div className="phase1-version-under-tab-spacer" aria-hidden="true" />
          </div>
        ) : null}
      </div>

      <div
        id="panel-phase-1"
        className={`screen ${phase === 1 ? "active" : ""}`}
        role="tabpanel"
        aria-labelledby="tab-phase-1"
      >
        {phaseOneScreen === "questions" ? (
          <div className="screen active">
            {phaseOneVersion === "A" ? (
              <>
                <div className="progress-bar">
                  {QUESTIONS.map((question, index) => (
                    <div
                      className={`dot ${index < currentQuestion ? "done" : ""} ${
                        index === currentQuestion ? "current" : ""
                      }`}
                      key={question.num}
                    />
                  ))}
                  <span className="prog-label">
                    {currentQuestion + 1} / {QUESTIONS.length}
                  </span>
                </div>

                <div className="q-card">
                  <div className="q-num">{currentQ.num}</div>
                  <div className="q-text">{currentQ.text}</div>
                  {currentQ.hints.length > 0 ? (
                    <div className="q-hints">
                      {currentQ.hints.map((hint) => (
                        <div key={hint}>· {hint}</div>
                      ))}
                    </div>
                  ) : null}
                  <div className="answer-input-wrap">
                    <textarea
                      placeholder="Type your answer here..."
                      value={
                        listeningQuestion === `A-${currentQuestion}` && speechDraft
                          ? `${answers[currentQuestion].trimEnd()}${answers[currentQuestion].trim() ? " " : ""}${speechDraft}`
                          : answers[currentQuestion]
                      }
                      onChange={(event) => {
                        setSpeechDraft("");
                        updateAnswer(event.target.value);
                      }}
                    />
                    <button
                      className={`mic-btn ${listeningQuestion === `A-${currentQuestion}` ? "listening" : ""}`}
                      type="button"
                      disabled={!speechSupported}
                      title={speechSupported ? "Use speech to text" : "Speech to text is not supported in this browser"}
                      aria-label={
                        listeningQuestion === `A-${currentQuestion}` ? "Stop speech to text" : "Start speech to text"
                      }
                      onClick={() => toggleSpeechInput(`A-${currentQuestion}`)}
                    >
                      {listeningQuestion === `A-${currentQuestion}` ? "●" : "🎙"}
                    </button>
                  </div>
                </div>

                <div className="nav-row">
                  <button type="button" onClick={prevQuestion} disabled={currentQuestion === 0}>
                    ← Back
                  </button>
                  <button className="primary" type="button" onClick={nextQuestion}>
                    {currentQuestion === QUESTIONS.length - 1 ? "Done — See my values ✓" : "Next →"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="progress-bar">
                  {VERSION_B_QUESTIONS.map((question, index) => (
                    <div
                      className={`dot ${index < versionBQuestionIndex ? "done" : ""} ${
                        index === versionBQuestionIndex ? "current" : ""
                      }`}
                      key={question.num}
                    />
                  ))}
                  <span className="prog-label">
                    {versionBQuestionIndex + 1} / {VERSION_B_QUESTIONS.length}
                  </span>
                </div>

                <div className="q-card">
                  <div className="q-num">{currentBQ.num}</div>
                  <div className="q-text">{currentBQ.text}</div>
                  <div className="answer-input-wrap">
                    <textarea
                      placeholder="Type your answer here..."
                      value={
                        listeningQuestion === `B-${versionBQuestionIndex}` && speechDraft
                          ? `${versionBAnswers[versionBQuestionIndex].trimEnd()}${
                              versionBAnswers[versionBQuestionIndex].trim() ? " " : ""
                            }${speechDraft}`
                          : versionBAnswers[versionBQuestionIndex]
                      }
                      onChange={(event) => {
                        setSpeechDraft("");
                        updateVersionBAnswer(versionBQuestionIndex, event.target.value);
                      }}
                    />
                    <button
                      className={`mic-btn ${listeningQuestion === `B-${versionBQuestionIndex}` ? "listening" : ""}`}
                      type="button"
                      disabled={!speechSupported}
                      title={speechSupported ? "Use speech to text" : "Speech to text is not supported in this browser"}
                      aria-label={
                        listeningQuestion === `B-${versionBQuestionIndex}`
                          ? "Stop speech to text"
                          : "Start speech to text"
                      }
                      onClick={() => toggleSpeechInput(`B-${versionBQuestionIndex}`)}
                    >
                      {listeningQuestion === `B-${versionBQuestionIndex}` ? "●" : "🎙"}
                    </button>
                  </div>

                  <p className="version-b-photo-prompt">
                    {versionBQuestionIndex === 0
                      ? "Add a picture or drawing that represents your hopeful future."
                      : "Add a picture or drawing that represents your worried future."}
                  </p>

                  <div className="photo-square-field">
                    <label
                      className={`photo-square-drop ${
                        versionBPhotos[versionBQuestionIndex] ? "has-photo" : ""
                      } ${versionBPhotoPanel ? "is-photo-active" : ""}`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="photo-square-input"
                        onChange={(event) => {
                          updateVersionBPhoto(versionBQuestionIndex, event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                      {versionBPhotos[versionBQuestionIndex] ? (
                        <>
                          <img
                            src={versionBPhotos[versionBQuestionIndex].url}
                            alt=""
                            className="photo-square-img"
                          />
                          <span className="photo-square-replace-hint">Tap to change photo</span>
                        </>
                      ) : (
                        <div className="photo-square-placeholder" aria-hidden="true">
                          <span className="photo-square-plus">+</span>
                          <span className="photo-square-label">Upload photo</span>
                        </div>
                      )}
                    </label>
                    {versionBPhotos[versionBQuestionIndex] ? (
                      <button
                        type="button"
                        className="photo-square-remove"
                        aria-label="Remove photo"
                        onClick={() => clearVersionBPhoto(versionBQuestionIndex)}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>

                  <div className="version-b-photo-actions">
                    <button
                      type="button"
                      className={`version-b-photo-action ${versionBPhotoPanel === "upload" ? "is-active" : ""}`}
                      onClick={() => toggleVersionBPhotoPanel("upload")}
                    >
                      Upload photo
                    </button>
                    <button
                      type="button"
                      className={`version-b-photo-action ${versionBPhotoPanel === "draw" ? "is-active" : ""}`}
                      onClick={() => toggleVersionBPhotoPanel("draw")}
                    >
                      Draw on canvas
                    </button>
                    <button
                      type="button"
                      className={`version-b-photo-action ${versionBPhotoPanel === "library" ? "is-active" : ""}`}
                      onClick={() => toggleVersionBPhotoPanel("library")}
                    >
                      Image library
                    </button>
                  </div>

                  {versionBPhotoPanel === "upload" ? (
                    <div className="version-b-photo-panel">
                      <input
                        ref={versionBUploadInputRef}
                        type="file"
                        accept="image/*"
                        className="version-b-upload-input"
                        onChange={(event) => {
                          updateVersionBPhoto(versionBQuestionIndex, event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        className="primary version-b-upload-button"
                        onClick={() => versionBUploadInputRef.current?.click()}
                      >
                        Choose photo from device
                      </button>
                    </div>
                  ) : null}

                  {versionBPhotoPanel === "draw" ? (
                    <div className="version-b-photo-panel">
                      {renderDrawingCanvasCard({
                        index: versionBQuestionIndex,
                        setting: versionBDrawSettings[versionBQuestionIndex] || {
                          tool: "free",
                          colorIndex: 0,
                          brushSize: 12,
                          sticker: STICKER_OPTIONS[0]
                        },
                        subtitle: "Draw a picture for your answer.",
                        stickerSeed: versionBQuestionStickerSeed(versionBQuestionIndex),
                        emojiPickerIndex: versionBDrawEmojiPickerIndex,
                        setEmojiPickerIndex: setVersionBDrawEmojiPickerIndex,
                        onUpdateSetting: (patch) => updateVersionBDrawSetting(versionBQuestionIndex, patch),
                        onSelectSticker: (emoji) => selectVersionBDrawSticker(versionBQuestionIndex, emoji),
                        onClear: () => clearVersionBDrawCanvas(versionBQuestionIndex),
                        canvasRefAssign: (element) => {
                          versionBDrawCanvasRefs.current[versionBQuestionIndex] = element;
                        },
                        onDrawStart: (event, useTouch = false) =>
                          handleDrawStart(versionBQuestionIndex, event, useTouch, {
                            canvasStatesRef: versionBCanvasStatesRef,
                            drawStartsRef: versionBDrawStartsRef,
                            drawInteractRef: versionBDrawInteractRef,
                            snapshotOnEnd: false
                          }),
                        onDrawMove: (event, useTouch = false) =>
                          handleDrawMove(versionBQuestionIndex, event, useTouch, {
                            canvasStatesRef: versionBCanvasStatesRef,
                            drawStartsRef: versionBDrawStartsRef,
                            drawInteractRef: versionBDrawInteractRef
                          }),
                        onDrawEnd: (event, useTouch = false) =>
                          handleDrawEnd(versionBQuestionIndex, event, useTouch, {
                            canvasStatesRef: versionBCanvasStatesRef,
                            drawStartsRef: versionBDrawStartsRef,
                            drawInteractRef: versionBDrawInteractRef,
                            snapshotOnEnd: false
                          })
                      })}
                      <button
                        type="button"
                        className="primary version-b-save-drawing"
                        onClick={() => saveVersionBDrawingFromCanvas(versionBQuestionIndex)}
                      >
                        Use this drawing
                      </button>
                    </div>
                  ) : null}

                  {versionBPhotoPanel === "library" ? (
                    <div className="version-b-photo-panel">
                      <div className="version-b-library-grid">
                        {versionBQuestionLibrary.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`version-b-library-item ${
                              versionBPhotos[versionBQuestionIndex]?.url === item.url ? "is-selected" : ""
                            }`}
                            aria-label={`Use ${item.name}`}
                            onClick={() => selectVersionBQuestionLibraryImage(item)}
                          >
                            <img src={item.url} alt="" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="nav-row">
                  <button type="button" onClick={prevVersionBQuestion} disabled={versionBQuestionIndex === 0}>
                    ← Back
                  </button>
                  <button className="primary" type="button" onClick={nextVersionBQuestion}>
                    {versionBQuestionIndex === VERSION_B_QUESTIONS.length - 1 ? "Done — See my values ✓" : "Next →"}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : phaseOneScreen === "values" ? (
          <div className="screen active phase-one-followup">
            {phaseOneVersion === "B" ? (
              <>
                <div className="section-title">
                  1. Based on the story you shared today, these are the values we identified.
                </div>
                {versionBBoardItems.some(
                  (item) => (item.type === "text" && item.text?.trim()) || (item.type === "image" && item.photo?.url)
                ) ? (
                  <>
                    <div className="section-sub">
                      Drag images and value text anywhere on the canvas. Tap the image library below to add photos.
                    </div>

                    <div
                      className="version-b-board"
                      ref={versionBBoardRef}
                      onPointerDown={() => setVersionBSelectedBoardItemId(null)}
                    >
                      {versionBBoardItems.map((item) => {
                        const isSelected = versionBSelectedBoardItemId === item.id;
                        const itemLabel =
                          item.type === "text"
                            ? item.text?.trim() || "Value text"
                            : item.photo?.name || "Image";
                        return (
                          <div
                            key={item.id}
                            className={`version-b-board-item version-b-board-item--${item.type} ${
                              isSelected ? "is-selected" : ""
                            }`}
                            style={{ left: `${item.x}%`, top: `${item.y}%` }}
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              setVersionBSelectedBoardItemId(item.id);
                              startVersionBBoardDrag(item.id, event);
                            }}
                          >
                            <button
                              type="button"
                              className="version-b-board-item-remove"
                              aria-label={`Remove ${itemLabel}`}
                              onClick={() => removeVersionBBoardItem(item.id)}
                            >
                              ×
                            </button>
                            {item.type === "text" ? (
                              <textarea
                                className="version-b-board-text"
                                value={item.text ?? ""}
                                aria-label={itemLabel}
                                rows={2}
                                onChange={(event) => updateVersionBBoardItemText(item.id, event.target.value)}
                              />
                            ) : (
                              <img
                                src={item.photo?.url}
                                alt=""
                                className="version-b-board-image"
                                draggable={false}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button type="button" className="version-b-add-value-btn" onClick={addVersionBBoardText}>
                      + Add new value
                    </button>

                    <ImageLibrary
                      items={versionBValuesLibrary}
                      activeUrl={versionBSelectedBoardImageUrl}
                      emptyHint="Add starter photos to src/assets/image-library/version-b/values/"
                      aiPlaceholder="Describe an image that represents this value..."
                      onAdd={addToVersionBValuesLibrary}
                      onSelect={selectVersionBValuesLibraryImage}
                      onGenerateAi={generateVersionBValuesAiImage}
                      showAiGenerate={false}
                    />
                  </>
                ) : (
                  <div className="ai-generating-card">
                    <div className="ai-generating-title">AI is generating values...</div>
                    <p>
                      The researcher will export your responses, process them with the approved AI system, and upload
                      the generated values here.
                    </p>
                  </div>
                )}

                <div className="goal-section version-b-goal-section">
                  <div className="section-title goal-title">
                    2. Let&apos;s set up a value-guided goal that you can achieve.
                  </div>
                  <textarea
                    className="goal-main-input goal-main-input--purple-accent goal-main-input--version-b-stack"
                    value={versionBGoalShort}
                    aria-label="Short-term goal"
                    placeholder="(short-term)"
                    onChange={(event) => setVersionBGoalShort(event.target.value)}
                  />
                  <textarea
                    className="goal-main-input goal-main-input--purple-accent goal-main-input--version-b-stack"
                    value={versionBGoalLong}
                    aria-label="Long-term goal"
                    placeholder="(long-term)"
                    onChange={(event) => setVersionBGoalLong(event.target.value)}
                  />
                  <button className="goal-add-card" type="button" aria-label="Add attachment (placeholder)">
                    <span aria-hidden="true">+</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="section-title">Based on the story you shared today, these are the values we identified.</div>
                {values.length > 0 ? (
                  <>
                    <div className="section-sub">Let&apos;s review them and set priorities.</div>

                    <div className="values-list">
                      {values.map((value, index) => (
                        <div className="v-item" key={index}>
                          <div className="v-icon-wrap">
                            <button
                              className={`v-icon-btn ${emojiPickerIndex === index ? "is-open" : ""}`}
                              type="button"
                              aria-label={`Choose icon for ${value}`}
                              aria-expanded={emojiPickerIndex === index}
                              onClick={() => toggleEmojiPicker(index)}
                            >
                              {valueIcons[index] || getValueIcon(value)}
                            </button>
                            {emojiPickerIndex === index ? (
                              <ValueEmojiPicker
                                currentEmoji={valueIcons[index] || getValueIcon(value)}
                                onSelect={(emoji) => setValueIcon(index, emoji)}
                                onClose={() => setEmojiPickerIndex(null)}
                              />
                            ) : null}
                          </div>
                          <input
                            className="v-text"
                            type="text"
                            value={value}
                            onChange={(event) => updateValue(index, event.target.value)}
                          />
                          <div className="v-arrows">
                            <button className="arr" type="button" onClick={() => moveValue(index, -1)}>
                              ▲
                            </button>
                            <button className="arr" type="button" onClick={() => moveValue(index, 1)}>
                              ▼
                            </button>
                          </div>
                          <button
                            className="v-remove"
                            type="button"
                            aria-label={`Remove ${value}`}
                            onClick={() => removeValue(index)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="add-row">
                      <input
                        type="text"
                        value={newValue}
                        placeholder="+ Add new value..."
                        onChange={(event) => setNewValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") addValue();
                        }}
                      />
                      <button className="add-confirm" type="button" onClick={addValue}>
                        +
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="ai-generating-card">
                    <div className="ai-generating-title">AI is generating values...</div>
                    <p>
                      The researcher will export your responses, process them with the approved AI system, and upload
                      the generated values here.
                    </p>
                  </div>
                )}

                {values.length > 0 ? (
                  <div className="goal-section">
                    <div className="section-title goal-title">Let&apos;s set up a value-guided goal that you can achieve.</div>
                    <div className="goal-helper">
                      Try to include: 🎯 what you want to do, 📏 how you’ll track progress, 💜 why it matters to you, and ⏰
                      when you hope to achieve it.
                    </div>
                    <textarea
                      className="goal-main-input"
                      value={goalData.summary}
                      aria-label="Value-guided goal"
                      onChange={(event) => updateGoalData("summary", event.target.value)}
                    />
                    <div className="goal-detail-box" aria-label="Goal details">
                      {GOAL_PROMPTS.map((prompt) => (
                        <label className="goal-detail-row" key={prompt.field}>
                          <span className="goal-detail-icon" aria-hidden="true">
                            {prompt.icon}
                          </span>
                          <span className="goal-detail-label">{prompt.shortLabel}</span>
                          <input
                            type="text"
                            value={goalData[prompt.field]}
                            aria-label={prompt.label}
                            onChange={(event) => updateGoalData(prompt.field, event.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="goal-example-row">
                      <button className="goal-example-btn" type="button" onClick={() => setShowGoalExample((current) => !current)}>
                        Example
                      </button>
                    </div>
                    {showGoalExample && (
                      <div className="goal-example-card">
                        <button
                          className="goal-example-close"
                          type="button"
                          aria-label="Close example"
                          onClick={() => setShowGoalExample(false)}
                        >
                          ×
                        </button>
                        <p>
                          <strong>Goal:</strong> “I want to build a healthy daily routine so I can keep up with school, manage my
                          transplant responsibly, and feel more independent and normal again.”
                        </p>
                        <div className="goal-example-item">
                          <strong>🎯 What specifically will I do?</strong>
                          <span>Take medicine on time, track my health, and follow a weekly school routine</span>
                        </div>
                        <div className="goal-example-item">
                          <strong>📏 How will I track progress?</strong>
                          <span>Complete my medication schedule and attend school consistently each week</span>
                        </div>
                        <div className="goal-example-item">
                          <strong>🪜 Can I realistically do this?</strong>
                          <span>Start with small routines and slowly build consistency</span>
                        </div>
                        <div className="goal-example-item">
                          <strong>💜 Why does this matter to me?</strong>
                          <span>Feel independent, stay healthy, and keep moving toward my future goals</span>
                        </div>
                        <div className="goal-example-item">
                          <strong>⏰ By when?</strong>
                          <span>Within the next 3 months</span>
                        </div>
                      </div>
                    )}
                    <button className="goal-add-card" type="button" aria-label="Add another goal">
                      <span aria-hidden="true">+</span>
                    </button>
                  </div>
                ) : null}
              </>
            )}

            <div className="nav-row">
              <button type="button" onClick={() => setPhaseOneScreen("questions")}>
                ← Edit answers
              </button>
              <button className="primary" type="button" onClick={completeCurrentToolAndContinue}>
                {continueFromValuesLabel}
              </button>
            </div>
          </div>
        ) : (
          <div className="screen active phase-one-summary">
            <div className="section-title">Review your identified values from Tool A and Tool B</div>
            <div className="section-sub">
              Choose which final values and goals to bring into Phase 2. Your researcher can save a Phase 1 checkpoint
              from the researcher page.
            </div>
            <div className="value-summary-counter" aria-live="polite">
              {phase2SelectedValues.length === 0
                ? `Select up to ${MAX_PHASE2_VALUES} values for Phase 2`
                : `${phase2SelectedValues.length} value${phase2SelectedValues.length === 1 ? "" : "s"} selected for Phase 2`}
            </div>

            {summaryValueItems.length === 0 ? (
              <p className="value-summary-empty">No values were identified yet. Go back and complete Tool A and Tool B.</p>
            ) : (
              <div className="value-summary-sections">
                {["A", "B"].map((source) => {
                  const sectionItems = summaryValueItems.filter((item) => item.source === source);
                  const toolGoal =
                    source === "A"
                      ? toolAGoalData.summary ||
                        [
                          toolAGoalData.action && `What: ${toolAGoalData.action}`,
                          toolAGoalData.progress && `How: ${toolAGoalData.progress}`,
                          toolAGoalData.meaning && `Why: ${toolAGoalData.meaning}`,
                          toolAGoalData.timing && `When: ${toolAGoalData.timing}`
                        ]
                          .filter(Boolean)
                          .join("\n")
                      : [
                          versionBGoalShort && `Short-term: ${versionBGoalShort}`,
                          versionBGoalLong && `Long-term: ${versionBGoalLong}`
                        ]
                          .filter(Boolean)
                          .join("\n");
                  return (
                    <section className="value-summary-section" key={source}>
                      <h3 className="value-summary-section-label">Tool {source}</h3>
                      {sectionItems.length === 0 ? (
                        <p className="value-summary-section-empty">No values identified</p>
                      ) : (
                        <div className="value-summary-pick-list">
                          {sectionItems.map((item) => (
                            <label
                              className={`value-summary-item ${
                                phase2SelectedValues.includes(item.text) ? "is-selected" : ""
                              } ${
                                !phase2SelectedValues.includes(item.text) &&
                                phase2SelectedValues.length >= MAX_PHASE2_VALUES
                                  ? "is-disabled"
                                  : ""
                              }`}
                              key={item.key}
                            >
                              <input
                                type="checkbox"
                                checked={phase2SelectedValues.includes(item.text)}
                                disabled={
                                  !phase2SelectedValues.includes(item.text) &&
                                  phase2SelectedValues.length >= MAX_PHASE2_VALUES
                                }
                                onChange={() => togglePhase2ValueSelection(item.text)}
                              />
                              <span className="value-summary-icon" aria-hidden="true">
                                {item.icon}
                              </span>
                              <span className="value-summary-text">{item.text}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="value-summary-goal-readonly">
                        <div className="value-summary-goals-label">Goal</div>
                        <label className="goal-carry-check value-summary-goal-check">
                          <input
                            type="checkbox"
                            checked={phase2SelectedGoalSources.includes(source)}
                            disabled={!toolGoal}
                            onChange={() => togglePhase2GoalSource(source)}
                          />
                          Use this goal in Phase 2
                        </label>
                        <div className="value-summary-goals-text">{toolGoal || "No goal entered yet."}</div>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            <div className="nav-row">
              <button
                type="button"
                onClick={() => {
                  setPhaseOneVersion(phaseOneSecondTool);
                  setPhaseOneScreen("values");
                }}
              >
                ← Back to Tool {phaseOneSecondTool}
              </button>
              <button
                className="primary"
                type="button"
                onClick={switchToPhaseTwoFromSummary}
              >
                Go to Phase 2 →
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        id="panel-phase-2"
        className={`screen ${phase === 2 ? "active" : ""}`}
        role="tabpanel"
        aria-labelledby="tab-phase-2"
      >
        {phaseTwoScreen === "tools" ? (
          <div className="screen active">
            <div className="tool-entry-grid">
              <button className="tool-entry-card active-tool" type="button" onClick={startToolAVennDiagram}>
                <span>Tool A</span>
                Venn Diagram
              </button>
              <button className="tool-entry-card active-tool" type="button" onClick={startToolBPuzzle}>
                <span>Tool B</span>
                Puzzle
              </button>
              <button className="tool-entry-card active-tool" type="button" onClick={startArtAndDrawingTool}>
                <span>Tool C</span>
                Art and Drawing
              </button>
            </div>
          </div>
        ) : phaseTwoScreen === "tool-a" ? (
          <div className="screen active phase2-embedded-tool">
            <div className="phase2-tool-nav">
              <button type="button" onClick={() => setPhaseTwoScreen("tools")}>
                ← Back to tools
              </button>
            </div>
            <ToolAVennDiagram youthValues={phase2YouthValueItems} />
          </div>
        ) : phaseTwoScreen === "tool-b" ? (
          <div className="screen active phase2-embedded-tool phase2-embedded-tool--wide">
            <div className="phase2-tool-nav">
              <button type="button" onClick={() => setPhaseTwoScreen("tools")}>
                ← Back to tools
              </button>
            </div>
            <ToolBPuzzle embedded youthValues={phase2YouthValueItems} />
          </div>
        ) : phaseTwoScreen === "shapes" ? (
          <div className="screen active">
            <div className="section-sub">
              If each of your values had a shape and color, what would it be? Draw freely or pick a shape.
            </div>

            {drawValues.map((value, index) => {
              const setting = drawSettings[index] || { tool: "free", colorIndex: 0, brushSize: 12 };
              return (
                <div className="draw-card" key={`${value}-${index}`}>
                  <div className="draw-header">
                    <div>
                      <div className="draw-title">If your value {index + 1} had a shape and color, what would it be?</div>
                      <div className="draw-subtitle">{value}</div>
                    </div>
                    <button className="small-button" type="button" onClick={() => clearCanvas(index)}>
                      Clear
                    </button>
                  </div>

                  <div className="toolbar">
                    <button
                      className={`tb-btn brush-tool-btn ${setting.tool === "free" ? "sel" : ""}`}
                      type="button"
                      aria-label="Use brush"
                      onClick={() => updateCanvasSetting(index, { tool: "free" })}
                    >
                      🖌
                    </button>
                    <div className="shape-tools">
                      {SHAPE_LIST.filter((shape) => shape !== "free").map((shape) => (
                        <button
                          className={`tb-btn ${setting.tool === shape ? "sel" : ""}`}
                          type="button"
                          key={shape}
                          onClick={() => updateCanvasSetting(index, { tool: shape })}
                        >
                          {SHAPE_ICONS[shape]}
                        </button>
                      ))}
                    </div>
                    <div className="sticker-tools" aria-label="Sticker tools">
                      {[getPhase2ValueIcon(value), ...STICKER_OPTIONS.filter((sticker) => sticker !== getPhase2ValueIcon(value))]
                        .slice(0, INLINE_STICKER_COUNT)
                        .map((sticker) => (
                        <button
                          className={`sticker-btn ${setting.tool === "sticker" && setting.sticker === sticker ? "sel" : ""}`}
                          type="button"
                          key={sticker}
                          aria-label={`Use ${sticker} sticker`}
                          onClick={() => selectCanvasSticker(index, sticker)}
                        >
                          {sticker}
                        </button>
                      ))}
                      <span className="sticker-more-wrap">
                        <button
                          className={`sticker-more-btn ${drawEmojiPickerIndex === index ? "sel" : ""}`}
                          type="button"
                          aria-label="Show more emoji stickers"
                          aria-expanded={drawEmojiPickerIndex === index}
                          onClick={() => setDrawEmojiPickerIndex((current) => (current === index ? null : index))}
                        >
                          More
                        </button>
                        {drawEmojiPickerIndex === index ? (
                          <ValueEmojiPicker
                            currentEmoji={setting.sticker || getPhase2ValueIcon(value)}
                            onSelect={(emoji) => selectCanvasSticker(index, emoji)}
                            onClose={() => setDrawEmojiPickerIndex(null)}
                          />
                        ) : null}
                      </span>
                    </div>
                    <div className="color-tools">
                      {COLORS.map((color, colorIndex) => (
                        <button
                          aria-label={`Use color ${color}`}
                          className={`color-swatch ${setting.colorIndex === colorIndex ? "sel" : ""}`}
                          key={color}
                          style={{ background: color }}
                          type="button"
                          onClick={() => updateCanvasSetting(index, { colorIndex })}
                        />
                      ))}
                    </div>
                    <div className="brush-row">
                      <div className="brush-label-row">
                        <span className="brush-label">Stroke</span>
                        <span className="brush-value">{setting.brushSize}</span>
                      </div>
                      <input
                        className="brush-input"
                        type="range"
                        min="2"
                        max="40"
                        value={setting.brushSize}
                        onChange={(event) => updateCanvasSetting(index, { brushSize: Number(event.target.value) })}
                      />
                    </div>
                  </div>

                  <canvas
                    className="draw-cv"
                    height="200"
                    ref={(element) => {
                      drawCanvasRefs.current[index] = element;
                    }}
                    onMouseDown={(event) => handleDrawStart(index, event)}
                    onMouseMove={(event) => handleDrawMove(index, event)}
                    onMouseUp={(event) => handleDrawEnd(index, event)}
                    onMouseLeave={(event) => handleDrawEnd(index, event)}
                    onTouchStart={(event) => handleDrawStart(index, event, true)}
                    onTouchMove={(event) => handleDrawMove(index, event, true)}
                    onTouchEnd={(event) => handleDrawEnd(index, event, true)}
                  />
                </div>
              );
            })}

            <div className="nav-row">
              <div />
              <button className="primary" type="button" onClick={showComposite}>
                Combine →
              </button>
            </div>
          </div>
        ) : phaseTwoScreen === "composite" ? (
          <div className="screen active">
            <div className="comp-card">
              <div className="comp-card-title">This is an image of my value.</div>
              <input
                className="title-inp"
                type="text"
                value={pictureTitle}
                placeholder="Title:"
                onChange={(event) => setPictureTitle(event.target.value)}
              />
              <div className="composite-draw-toolbar" aria-label="My value image drawing tools">
                <button
                  className={`composite-draw-tool ${compositeDrawTool === "brush" ? "sel" : ""}`}
                  type="button"
                  aria-pressed={compositeDrawTool === "brush"}
                  onClick={() => setCompositeDrawTool("brush")}
                >
                  🖌 Brush
                </button>
                <button
                  className={`composite-draw-tool ${compositeDrawTool === "eraser" ? "sel" : ""}`}
                  type="button"
                  aria-pressed={compositeDrawTool === "eraser"}
                  onClick={() => setCompositeDrawTool("eraser")}
                >
                  ⌫ Eraser
                </button>
                <button
                  className="composite-draw-tool"
                  type="button"
                  disabled={compositeStrokesRef.current.length === 0}
                  onClick={undoCompositeDrawing}
                >
                  ↶ Undo
                </button>
                <div className="composite-draw-colors" aria-label="Brush colors">
                  {COLORS.slice(0, 9).map((color, colorIndex) => (
                    <button
                      aria-label={`Use value image color ${color}`}
                      className={`composite-color-swatch ${compositeBrushColorIndex === colorIndex ? "sel" : ""}`}
                      key={color}
                      style={{ background: color }}
                      type="button"
                      onClick={() => setCompositeBrushColorIndex(colorIndex)}
                    />
                  ))}
                </div>
                <label className="composite-brush-size">
                  Size
                  <input
                    type="range"
                    min="3"
                    max="28"
                    value={compositeBrushSize}
                    onChange={(event) => setCompositeBrushSize(Number(event.target.value))}
                  />
                </label>
              </div>
              <div className="canvas-wrap">
                <div className="composite-canvas-stack">
                  <canvas
                    className="comp-canvas"
                    height="340"
                    ref={compositeCanvasRef}
                    width="400"
                    onMouseDown={(event) => handleCompositeStart(event)}
                    onMouseMove={(event) => handleCompositeMove(event)}
                    onMouseUp={handleCompositeEnd}
                    onMouseLeave={handleCompositeEnd}
                    onTouchStart={(event) => handleCompositeStart(event, true)}
                    onTouchMove={(event) => handleCompositeMove(event, true)}
                    onTouchEnd={handleCompositeEnd}
                  />
                  <canvas
                    className="composite-draw-canvas"
                    ref={compositeDrawCanvasRef}
                    onMouseDown={(event) => handleCompositeDrawStart(event)}
                    onMouseMove={(event) => handleCompositeDrawMove(event)}
                    onMouseUp={handleCompositeDrawEnd}
                    onMouseLeave={handleCompositeDrawEnd}
                    onTouchStart={(event) => handleCompositeDrawStart(event, true)}
                    onTouchMove={(event) => handleCompositeDrawMove(event, true)}
                    onTouchEnd={handleCompositeDrawEnd}
                  />
                </div>
              </div>
              {phaseOneGoalText ? (
                <div className="comp-goal-card">
                  <div className="comp-goal-label">My value-guided goal</div>
                  <div className="comp-goal-text">{phaseOneGoalText}</div>
                </div>
              ) : null}
              <div className="value-legend">
                {drawValues.map((value, index) => (
                  <div className="legend-item" key={`${value}-${index}`}>
                    {legendThumbs[index] ? (
                      <img className="legend-thumb" src={legendThumbs[index]} width="44" height="44" alt="" />
                    ) : (
                      <div className="legend-thumb empty-thumb" aria-hidden="true" />
                    )}
                    <div className="legend-label">value {index + 1}</div>
                    <div className="legend-value-name">{value.slice(0, 20)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="share-row">
              <label className="share-check">
                <input
                  type="checkbox"
                  checked={shareTargets.caregiver}
                  onChange={() => toggleShareTarget("caregiver")}
                />
                Share with your caregiver
              </label>
              <label className="share-check">
                <input
                  type="checkbox"
                  checked={shareTargets.clinician}
                  onChange={() => toggleShareTarget("clinician")}
                />
                Share with your clinician
              </label>
              <button className="primary" type="button">
                Share
              </button>
            </div>
            <div className="nav-row">
              <button className="redraw-button" type="button" onClick={() => setPhaseTwoScreen("shapes")}>
                ← Redraw
              </button>
              <button className="primary" type="button" onClick={showStakeholderCombine}>
                Combine with stakeholders →
              </button>
            </div>
          </div>
        ) : (
          <div className="screen active">
            <div className="section-title">Let&apos;s share our values with each other and create a picture that represents what we care about together.</div>
            <div className="section-sub">
              AI can help combine our ideas and values into one image, making it easier to understand each other.
            </div>

            <div className="stakeholder-layout">
              <div className="component-library">
                {Object.entries(groupedComponents).map(([owner, group]) => (
                  <div className="component-group" key={owner}>
                    <div className="component-group-title">{group.label}</div>
                    <div className="component-grid">
                      {group.items.map((component) => (
                        <div
                          className="component-piece"
                          draggable
                          key={component.id}
                          onDragStart={(event) => startComponentDrag(event, { source: "tray", component })}
                        >
                          {component.src ? <img src={component.src} alt="" /> : <div className="source-empty" />}
                          <div className="component-piece-label">{component.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="shared-picture-card">
                <div className="shared-picture-header">
                  <div className="shared-picture-title">Our Shard Values</div>
                  {participantFinished ? (
                    <span className="shared-done-status">{sessionSaveStatus || "Done"}</span>
                  ) : (
                    <button className="primary shared-done-button" type="button" onClick={finishParticipantSession}>
                      Done
                    </button>
                  )}
                </div>
                <div className="shared-draw-toolbar" aria-label="Shared value drawing tools">
                  <button
                    className={`shared-draw-tool ${sharedDrawTool === "select" ? "sel" : ""}`}
                    type="button"
                    aria-pressed={sharedDrawTool === "select"}
                    onClick={() => setSharedDrawTool("select")}
                  >
                    Select
                  </button>
                  <button
                    className={`shared-draw-tool ${sharedDrawTool === "brush" ? "sel" : ""}`}
                    type="button"
                    aria-pressed={sharedDrawTool === "brush"}
                    onClick={() => setSharedDrawTool("brush")}
                  >
                    ✎ Brush
                  </button>
                  <button
                    className={`shared-draw-tool ${sharedDrawTool === "eraser" ? "sel" : ""}`}
                    type="button"
                    aria-pressed={sharedDrawTool === "eraser"}
                    onClick={() => setSharedDrawTool("eraser")}
                  >
                    ⌫ Eraser
                  </button>
                  <button
                    className="shared-draw-tool"
                    type="button"
                    disabled={sharedStrokesRef.current.length === 0}
                    onClick={undoSharedDrawing}
                  >
                    ↶ Undo
                  </button>
                  <div className="shared-draw-colors" aria-label="Brush colors">
                    {COLORS.slice(0, 9).map((color, colorIndex) => (
                      <button
                        aria-label={`Use shared canvas color ${color}`}
                        className={`shared-color-swatch ${sharedBrushColorIndex === colorIndex ? "sel" : ""}`}
                        key={color}
                        style={{ background: color }}
                        type="button"
                        onClick={() => setSharedBrushColorIndex(colorIndex)}
                      />
                    ))}
                  </div>
                  <label className="shared-brush-size">
                    Size
                    <input
                      type="range"
                      min="3"
                      max="28"
                      value={sharedBrushSize}
                      onChange={(event) => setSharedBrushSize(Number(event.target.value))}
                    />
                  </label>
                </div>
                <div
                  className="shared-picture-board component-drop-board"
                  onClick={() => setSelectedPlacedId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleBoardDrop}
                >
                  <canvas
                    className={`shared-draw-canvas ${sharedDrawTool === "select" ? "is-selecting" : ""}`}
                    ref={sharedCanvasRef}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleBoardDrop}
                    onMouseDown={(event) => handleSharedDrawStart(event)}
                    onMouseMove={(event) => handleSharedDrawMove(event)}
                    onMouseUp={handleSharedDrawEnd}
                    onMouseLeave={handleSharedDrawEnd}
                    onTouchStart={(event) => handleSharedDrawStart(event, true)}
                    onTouchMove={(event) => handleSharedDrawMove(event, true)}
                    onTouchEnd={handleSharedDrawEnd}
                  />
                  {placedComponents.map((component) => (
                    <div
                      className={`placed-component ${selectedPlacedId === component.instanceId ? "is-selected" : ""}`}
                      key={component.instanceId}
                      data-instance-id={component.instanceId}
                      style={{
                        left: component.x,
                        top: component.y,
                        width: 96 * component.scale,
                        transform: `translate(-50%, -50%) rotate(${component.rotation}deg)`
                      }}
                      onClick={(event) => selectPlacedValue(event, component.instanceId)}
                    >
                      <img
                        draggable
                        src={component.src}
                        alt=""
                        onDragStart={(event) =>
                          startComponentDrag(event, { source: "placed", id: component.instanceId, instanceId: component.instanceId })
                        }
                      />
                      {selectedPlacedId === component.instanceId ? (
                        <>
                          <button
                            type="button"
                            aria-label="Resize value"
                            className="placed-resize-handle"
                            onMouseDown={(event) => startValueResize(event, component)}
                            onTouchStart={(event) => startValueResize(event, component)}
                          />
                          <button type="button" className="placed-action rotate" onClick={() => rotatePlacedComponent(component.instanceId)}>
                            ↻
                          </button>
                          <button type="button" className="placed-action remove" onClick={() => removePlacedComponent(component.instanceId)}>
                            ×
                          </button>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="stakeholder-goals-card">
                  <div className="stakeholder-goals-title">Final goals from each stakeholder</div>
                  <div className="stakeholder-goals-list">
                    <div className="stakeholder-goal-row stakeholder-goal-row--youth">
                      <div className="stakeholder-goal-person">My goal</div>
                      <div className="stakeholder-goal-text">
                        {phaseOneGoalText || "No youth goal selected to bring forward."}
                      </div>
                    </div>
                    {STAKEHOLDER_FINAL_GOALS.map((stakeholder) => (
                      <div className="stakeholder-goal-row" key={stakeholder.role}>
                        <div className="stakeholder-goal-person" style={{ color: stakeholder.color }}>
                          {stakeholder.label} goal
                        </div>
                        <div className="stakeholder-goal-text">{stakeholder.goal}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="nav-row">
              <button className="redraw-button" type="button" onClick={() => setPhaseTwoScreen("composite")}>
                ← Back to my picture
              </button>
            </div>
            {!participantFinished && sessionSaveStatus ? (
              <p className="session-save-status session-save-status--error">{sessionSaveStatus}</p>
            ) : null}
          </div>
        )}
      </div>
      </>
      ) : null}
    </div>
  );
}

function GoalField({ field, value, editingField, onEdit, onSave }) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);
  const isEditing = editingField === field;

  useEffect(() => {
    if (isEditing) {
      setDraft(value === GOAL_PLACEHOLDERS[field] ? "" : value);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [field, isEditing, value]);

  if (isEditing) {
    return (
      <input
        className="inline-inp"
        ref={inputRef}
        type="text"
        value={draft}
        placeholder={GOAL_PLACEHOLDERS[field]}
        onBlur={() => onSave(field, draft)}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSave(field, draft);
        }}
      />
    );
  }

  return (
    <span className="editable" onClick={() => onEdit(field)}>
      {value}
    </span>
  );
}
