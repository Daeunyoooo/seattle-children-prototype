import { dataUrlToBase64Payload, slugifyValueName } from "./toolCLogData.js";
import { isRemoteStorageConfigured, uploadSessionAsset } from "./sessionStorage.js";

function isDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:");
}

function cloneSession(session) {
  return JSON.parse(JSON.stringify(session));
}

async function offloadDataUrl(sessionId, relativePath, dataUrl) {
  if (!isDataUrl(dataUrl)) return null;
  return uploadSessionAsset({
    sessionId,
    path: relativePath,
    dataUrl,
    contentType: dataUrlToBase64Payload(dataUrl)?.mime || "image/png"
  });
}

async function offloadPhoto(sessionId, relativePath, photo) {
  if (!photo || typeof photo !== "object") return photo;
  if (photo.storageUrl && !isDataUrl(photo.dataUrl)) {
    const { dataUrl, ...rest } = photo;
    void dataUrl;
    return rest;
  }
  const sourceDataUrl = isDataUrl(photo.dataUrl)
    ? photo.dataUrl
    : isDataUrl(photo.url)
      ? photo.url
      : "";
  if (!sourceDataUrl) return photo;

  const storageUrl = await offloadDataUrl(sessionId, relativePath, sourceDataUrl);
  if (!storageUrl) return photo;

  const next = {
    name: photo.name || "",
    source: photo.source || (photo.isUpload ? "participant-upload" : "library"),
    storageUrl
  };
  return next;
}

async function offloadPngImage(sessionId, relativePath, image) {
  if (!image || typeof image !== "object") return image;
  if (image.storageUrl && !isDataUrl(image.pngDataUrl)) {
    const { pngDataUrl, ...rest } = image;
    void pngDataUrl;
    return rest;
  }
  if (!isDataUrl(image.pngDataUrl)) return image;

  const storageUrl = await offloadDataUrl(sessionId, relativePath, image.pngDataUrl);
  if (!storageUrl) return image;

  const { pngDataUrl, ...rest } = image;
  void pngDataUrl;
  return {
    ...rest,
    storageUrl,
    file: rest.file || relativePath.split("/").pop()
  };
}

async function offloadLinkedDrawings(sessionId, folder, drawings) {
  if (!Array.isArray(drawings)) return drawings;
  const next = [];
  for (let index = 0; index < drawings.length; index += 1) {
    const drawing = drawings[index];
    const slug = slugifyValueName(drawing?.valueName, `drawing-${index}`);
    next.push(await offloadPngImage(sessionId, `${folder}/${slug}.png`, drawing));
  }
  return next;
}

/**
 * Upload embedded data-URL images to Supabase Storage and return a lean session
 * payload that references public storageUrl values instead of base64.
 * No-op when remote storage is not configured.
 */
export async function offloadSessionAssets(session) {
  if (!session || !isRemoteStorageConfigured()) return session;

  const sessionId = String(session.sessionId || "").trim();
  if (!sessionId) return session;

  const next = cloneSession(session);

  if (Array.isArray(next.toolB?.questions)) {
    next.toolB.questions = await Promise.all(
      next.toolB.questions.map(async (question, index) => ({
        ...question,
        photo: await offloadPhoto(sessionId, `phase1/tool-b/q${index}.png`, question.photo)
      }))
    );
  }

  if (Array.isArray(next.toolB?.boardItems)) {
    next.toolB.boardItems = await Promise.all(
      next.toolB.boardItems.map(async (item, index) => {
        if (item?.type !== "image") return item;
        return {
          ...item,
          photo: await offloadPhoto(sessionId, `phase1/tool-b/board-${item.id || index}.png`, item.photo)
        };
      })
    );
  }

  const toolC = next.phaseTwo?.toolC;
  if (toolC) {
    if (Array.isArray(toolC.perValueDrawings)) {
      toolC.perValueDrawings = await Promise.all(
        toolC.perValueDrawings.map(async (drawing, index) => {
          const slug = slugifyValueName(drawing?.valueName, `value-${index}`);
          return offloadPngImage(sessionId, `phase2/tool-c/${slug}.png`, drawing);
        })
      );
    }
    if (toolC.composite?.finalImage) {
      toolC.composite.finalImage = await offloadPngImage(
        sessionId,
        "phase2/tool-c/composite.png",
        toolC.composite.finalImage
      );
    }
    if (toolC.stakeholders?.finalImage) {
      toolC.stakeholders.finalImage = await offloadPngImage(
        sessionId,
        "phase2/tool-c/stakeholders.png",
        toolC.stakeholders.finalImage
      );
    }
    if (Array.isArray(toolC.legendThumbs)) {
      toolC.legendThumbs = await Promise.all(
        toolC.legendThumbs.map(async (thumb, index) => {
          if (!isDataUrl(thumb)) return thumb;
          return (
            (await offloadDataUrl(sessionId, `phase2/tool-c/legend-${index}.png`, thumb)) || thumb
          );
        })
      );
    }
  }

  if (Array.isArray(next.linkedYouthDrawings)) {
    next.linkedYouthDrawings = await offloadLinkedDrawings(
      sessionId,
      "linked/youth",
      next.linkedYouthDrawings
    );
  }
  if (Array.isArray(next.linkedCaregiverDrawings)) {
    next.linkedCaregiverDrawings = await offloadLinkedDrawings(
      sessionId,
      "linked/caregiver",
      next.linkedCaregiverDrawings
    );
  }

  return next;
}

export function getPhotoPreviewSrc(photo) {
  if (!photo) return "";
  return photo.dataUrl || photo.storageUrl || (photo.url && !String(photo.url).startsWith("blob:") ? photo.url : "") || "";
}
