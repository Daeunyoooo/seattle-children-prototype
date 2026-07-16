/** Tool B image library — 10 seed images per folder (questions + values). */
export const VERSION_B_LIBRARY_FILES = [
  "concern.png",
  "dream.png",
  "healthy.png",
  "healthy_food.png",
  "pet.png",
  "self.png",
  "sport.png",
  "study.png",
  "sweet_home.png",
  "worry.png"
];

export function labelFromImageFile(fileName) {
  const base = String(fileName || "").replace(/\.[^.]+$/, "");
  return base
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
