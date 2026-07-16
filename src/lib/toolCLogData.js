export function slugifyValueName(name, fallback = "value") {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || fallback;
}

export function dataUrlToBase64Payload(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ""));
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

export async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function getToolCImageUrl(sessionId, relativePath) {
  void sessionId;
  void relativePath;
  return "";
}

export async function hydrateToolCImageFields(sessionId, toolC) {
  void sessionId;
  return toolC;
}
