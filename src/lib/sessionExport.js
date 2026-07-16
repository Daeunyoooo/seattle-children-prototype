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
  if (photo.isUpload && photo.url?.startsWith("blob:")) {
    const dataUrl = await blobUrlToDataUrl(photo.url);
    return dataUrl ? { ...base, dataUrl } : base;
  }
  if (photo.url && !photo.url.startsWith("blob:")) {
    return { ...base, url: photo.url };
  }
  return base;
}
