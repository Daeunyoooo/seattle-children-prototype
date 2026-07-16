import { useEffect, useMemo, useRef, useState } from "react";

/** Default suggestions shown when search is empty (Tool A value icons). */
export const VALUE_ICON_OPTIONS = ["💪", "🌱", "🎓", "😊", "❤️", "🎯", "⭐"];

const EMOJI_CATALOG = [
  { emoji: "💪", keywords: ["strength", "muscle", "health", "fitness", "strong", "physical", "recovery"] },
  { emoji: "🌱", keywords: ["grow", "growth", "life", "normal", "routine", "plant", "nature"] },
  { emoji: "🎓", keywords: ["school", "degree", "education", "study", "graduate", "work", "career"] },
  { emoji: "😊", keywords: ["happy", "happiness", "joy", "smile", "feel good"] },
  { emoji: "❤️", keywords: ["love", "heart", "family", "people", "care", "support"] },
  { emoji: "🎯", keywords: ["goal", "target", "focus", "achieve", "future"] },
  { emoji: "⭐", keywords: ["star", "favorite", "important", "value"] },
  { emoji: "🏥", keywords: ["hospital", "health", "medical", "clinic", "care"] },
  { emoji: "💊", keywords: ["medicine", "medication", "pill", "treatment"] },
  { emoji: "🩺", keywords: ["doctor", "checkup", "health"] },
  { emoji: "🧬", keywords: ["transplant", "science", "health"] },
  { emoji: "🫀", keywords: ["heart", "organ", "health"] },
  { emoji: "🦴", keywords: ["bone", "strength", "body"] },
  { emoji: "🧘", keywords: ["calm", "wellness", "mind", "peace"] },
  { emoji: "🏃", keywords: ["run", "exercise", "active", "sport"] },
  { emoji: "⚽", keywords: ["sport", "play", "team", "fun"] },
  { emoji: "📚", keywords: ["books", "learn", "study", "school"] },
  { emoji: "✏️", keywords: ["write", "homework", "school"] },
  { emoji: "💼", keywords: ["job", "work", "career"] },
  { emoji: "🔬", keywords: ["science", "research", "learn"] },
  { emoji: "🎨", keywords: ["art", "creative", "express"] },
  { emoji: "🎵", keywords: ["music", "hobby", "fun"] },
  { emoji: "🎮", keywords: ["game", "play", "fun"] },
  { emoji: "🏠", keywords: ["home", "family", "safe", "normal"] },
  { emoji: "👨‍👩‍👧", keywords: ["family", "parents", "together"] },
  { emoji: "👫", keywords: ["friends", "people", "social"] },
  { emoji: "🤝", keywords: ["help", "support", "together", "team"] },
  { emoji: "🫂", keywords: ["hug", "comfort", "support"] },
  { emoji: "🙏", keywords: ["hope", "grateful", "faith"] },
  { emoji: "😌", keywords: ["calm", "relief", "peaceful"] },
  { emoji: "😄", keywords: ["laugh", "fun", "happy"] },
  { emoji: "🥰", keywords: ["love", "warm", "care"] },
  { emoji: "💜", keywords: ["meaning", "matter", "purple", "heart"] },
  { emoji: "💙", keywords: ["trust", "calm", "blue", "heart"] },
  { emoji: "💚", keywords: ["health", "green", "heart", "nature"] },
  { emoji: "🌈", keywords: ["hope", "diversity", "bright", "future"] },
  { emoji: "☀️", keywords: ["sun", "bright", "day", "positive"] },
  { emoji: "🌙", keywords: ["night", "rest", "sleep"] },
  { emoji: "🌳", keywords: ["tree", "nature", "outside"] },
  { emoji: "🌸", keywords: ["flower", "spring", "beauty"] },
  { emoji: "🦋", keywords: ["change", "transform", "hope"] },
  { emoji: "🐾", keywords: ["pet", "animal", "comfort"] },
  { emoji: "🍎", keywords: ["food", "healthy", "nutrition"] },
  { emoji: "💧", keywords: ["water", "hydration", "clean"] },
  { emoji: "🔥", keywords: ["energy", "motivation", "passion"] },
  { emoji: "✨", keywords: ["magic", "special", "sparkle", "ai"] },
  { emoji: "🏆", keywords: ["win", "achievement", "success"] },
  { emoji: "📈", keywords: ["progress", "improve", "track"] },
  { emoji: "📏", keywords: ["measure", "track", "progress"] },
  { emoji: "⏰", keywords: ["time", "when", "schedule", "deadline"] },
  { emoji: "📅", keywords: ["calendar", "plan", "date"] },
  { emoji: "🗺️", keywords: ["journey", "path", "future", "plan"] },
  { emoji: "🧭", keywords: ["direction", "guide", "values"] },
  { emoji: "🔑", keywords: ["key", "unlock", "important"] },
  { emoji: "💡", keywords: ["idea", "insight", "learn"] },
  { emoji: "🛡️", keywords: ["protect", "safe", "security"] },
  { emoji: "🌟", keywords: ["shine", "special", "star"] },
  { emoji: "🎉", keywords: ["celebrate", "party", "milestone"] },
  { emoji: "🙂", keywords: ["okay", "fine", "neutral", "smile"] },
  { emoji: "😢", keywords: ["sad", "worry", "hard"] },
  { emoji: "😰", keywords: ["worry", "anxious", "stress"] },
  { emoji: "💪🏽", keywords: ["strength", "strong"] },
  { emoji: "🧑‍🎓", keywords: ["student", "graduate", "school"] },
  { emoji: "👩‍⚕️", keywords: ["nurse", "doctor", "clinician"] }
];

function extractEmojiFromSearch(query) {
  const match = query.match(/\p{Extended_Pictographic}/u);
  return match ? match[0] : null;
}

function filterCatalog(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    const suggested = new Set(VALUE_ICON_OPTIONS);
    const rest = EMOJI_CATALOG.filter((entry) => !suggested.has(entry.emoji));
    return [
      ...VALUE_ICON_OPTIONS.map((emoji) => EMOJI_CATALOG.find((e) => e.emoji === emoji) || { emoji, keywords: [] }),
      ...rest
    ];
  }

  return EMOJI_CATALOG.filter((entry) => {
    if (entry.emoji.includes(normalized)) return true;
    return entry.keywords.some((word) => word.includes(normalized) || normalized.includes(word));
  });
}

export default function ValueEmojiPicker({ currentEmoji, onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const customEmoji = useMemo(() => extractEmojiFromSearch(search), [search]);
  const filtered = useMemo(() => filterCatalog(search), [search]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (rootRef.current?.contains(event.target)) return;
      onClose();
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function pick(emoji) {
    onSelect(emoji);
    onClose();
  }

  return (
    <div className="value-emoji-picker" ref={rootRef} role="dialog" aria-label="Choose an emoji">
      <button type="button" className="value-emoji-picker-close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <input
        ref={searchRef}
        type="search"
        className="value-emoji-picker-search"
        placeholder="Search (e.g. happy, school) or paste an emoji"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && customEmoji) {
            event.preventDefault();
            pick(customEmoji);
          }
        }}
      />
      {customEmoji && !filtered.some((entry) => entry.emoji === customEmoji) ? (
        <button type="button" className="value-emoji-picker-custom" onClick={() => pick(customEmoji)}>
          Use <span aria-hidden="true">{customEmoji}</span>
        </button>
      ) : null}
      <div className="value-emoji-picker-grid" role="listbox" aria-label="Emoji options">
        {filtered.length === 0 ? (
          <p className="value-emoji-picker-empty">No matches. Try another word or paste an emoji.</p>
        ) : (
          filtered.map((entry) => (
            <button
              key={entry.emoji}
              type="button"
              role="option"
              aria-selected={entry.emoji === currentEmoji}
              className={`value-emoji-picker-item ${entry.emoji === currentEmoji ? "is-selected" : ""}`}
              onClick={() => pick(entry.emoji)}
              title={entry.keywords.slice(0, 3).join(", ")}
            >
              {entry.emoji}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
