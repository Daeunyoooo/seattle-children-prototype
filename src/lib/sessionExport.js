export const PARTICIPANT_EXPORT_SCHEMA_V2 = "seattle-childrens.participant-response.v2";

export function serializePerValueDrawing(canvasState, exportCroppedPNG) {
  if (!canvasState) return null;
  const exported = exportCroppedPNG?.(canvasState);
  if (!exported?.dataURL) return null;
  return {
    valueName: canvasState.valueName || "",
    pngDataUrl: exported.dataURL,
    pngWidth: exported.w,
    pngHeight: exported.h
  };
}

export function serializeFinalImage(exported) {
  if (!exported?.dataURL) return null;
  return {
    pngDataUrl: exported.dataURL,
    pngWidth: exported.w,
    pngHeight: exported.h
  };
}

function cloneAiValueList(list) {
  return (Array.isArray(list) ? list : []).map((value) =>
    value && typeof value === "object" ? { ...value } : value
  );
}

export function toEditedValueEntries(texts, icons = []) {
  const entries = [];
  (Array.isArray(texts) ? texts : []).forEach((text, index) => {
    const clean = String(text || "").trim();
    if (!clean) return;
    entries.push({
      text: clean,
      icon: icons?.[index] || null
    });
  });
  return entries;
}

function previousEditedValues(session, tool) {
  const fromLog = session?.part1ValueLog?.userEdited?.[tool];
  if (Array.isArray(fromLog) && fromLog.length > 0) {
    return fromLog.map((entry) => ({
      text: String(entry?.text || "").trim(),
      icon: entry?.icon || null
    })).filter((entry) => entry.text);
  }
  const toolPayload = tool === "B" ? session?.toolB : session?.toolA;
  return toEditedValueEntries(toolPayload?.identifiedValues, toolPayload?.valueIcons);
}

function previousAiValues(session, tool) {
  const fromLog = session?.part1ValueLog?.aiGenerated?.[tool];
  if (Array.isArray(fromLog) && fromLog.length > 0) return cloneAiValueList(fromLog);
  const fromByTool = session?.aiGeneratedValuesByTool?.[tool];
  if (Array.isArray(fromByTool) && fromByTool.length > 0) return cloneAiValueList(fromByTool);
  return [];
}

/**
 * Part 1 keeps three value records:
 * - aiGenerated: frozen at AI import, not replaced by later edits
 * - userEdited: the participant's current list for each tool
 * - selected: values checked for Part 2
 */
export function buildPart1ValueLog({
  previousSession = null,
  aiReplacementByTool = null,
  aiFallbackByTool = null,
  editedByTool = null,
  authoritativeEditedTools = [],
  selectedValues = []
} = {}) {
  const authoritative = new Set(authoritativeEditedTools);
  const aiGenerated = {};
  const userEdited = {};

  for (const tool of ["A", "B"]) {
    const replacement = aiReplacementByTool?.[tool];
    const fallback = aiFallbackByTool?.[tool];
    if (Array.isArray(replacement) && replacement.length > 0) {
      aiGenerated[tool] = cloneAiValueList(replacement);
    } else {
      const previous = previousAiValues(previousSession, tool);
      aiGenerated[tool] =
        previous.length > 0
          ? previous
          : Array.isArray(fallback) && fallback.length > 0
            ? cloneAiValueList(fallback)
            : [];
    }

    const live = Array.isArray(editedByTool?.[tool]) ? editedByTool[tool] : null;
    if (authoritative.has(tool) && live) {
      userEdited[tool] = live;
    } else if (live && live.length > 0) {
      userEdited[tool] = live;
    } else {
      userEdited[tool] = previousEditedValues(previousSession, tool);
    }
  }

  const selected = (Array.isArray(selectedValues) ? selectedValues : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return { aiGenerated, userEdited, selected };
}

export function legacyAiGeneratedValues(previousSession, valueLog, currentTool) {
  const current = valueLog?.aiGenerated?.[currentTool];
  if (Array.isArray(current) && current.length > 0) return cloneAiValueList(current);
  if (Array.isArray(previousSession?.aiGeneratedValues) && previousSession.aiGeneratedValues.length > 0) {
    return cloneAiValueList(previousSession.aiGeneratedValues);
  }
  if (valueLog?.aiGenerated?.A?.length) return cloneAiValueList(valueLog.aiGenerated.A);
  if (valueLog?.aiGenerated?.B?.length) return cloneAiValueList(valueLog.aiGenerated.B);
  return [];
}

export function buildPhaseTwoExport({
  phase,
  phaseTwoScreen,
  drawValues,
  perValueDrawings = [],
  pictureTitle,
  legendThumbs,
  shareTargets,
  compositeFinalImage,
  stakeholderFinalImage
}) {
  return {
    phase,
    currentScreen: phaseTwoScreen,
    toolC: {
      drawValues: [...(drawValues || [])],
      perValueDrawings: [...(perValueDrawings || [])],
      composite: {
        pictureTitle: pictureTitle || "",
        legendThumbs: [...(legendThumbs || [])],
        shareTargets: { ...(shareTargets || { caregiver: true, clinician: true }) },
        finalImage: compositeFinalImage || null
      },
      stakeholders: {
        finalImage: stakeholderFinalImage || null
      }
    },
    systemVisualizations: {
      toolA: phaseTwoScreen === "tool-a" ? "venn-diagram" : null,
      toolB: phaseTwoScreen === "tool-b" ? "puzzle" : null,
      toolC: ["shapes", "composite", "stakeholders"].includes(phaseTwoScreen)
        ? phaseTwoScreen === "stakeholders"
          ? "stakeholder-combine"
          : phaseTwoScreen
        : null
    }
  };
}

async function blobUrlToDataUrl(url) {
  if (!url || !url.startsWith("blob:")) return url || null;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function serializePhotoForExport(photo) {
  if (!photo) return null;
  const base = {
    name: photo.name || "",
    source: photo.isUpload ? "participant-upload" : photo.source || "library"
  };
  if (photo.storageUrl) {
    return { ...base, storageUrl: photo.storageUrl };
  }
  if (photo.dataUrl) {
    return { ...base, dataUrl: photo.dataUrl };
  }
  // Values-board uploads and drawings often keep a blob: URL without isUpload set.
  if (photo.url?.startsWith("blob:")) {
    const dataUrl = await blobUrlToDataUrl(photo.url);
    return dataUrl ? { ...base, dataUrl, source: photo.isUpload ? "participant-upload" : base.source } : base;
  }
  if (photo.url) {
    return { ...base, url: photo.url };
  }
  return base;
}
