const cleanText = (value, maxLength) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maxLength);

export function normalizeCasePilotFollowups(rawItems, translateKnownId) {
  if (!Array.isArray(rawItems)) return [];

  const seen = new Set();
  return rawItems.flatMap((item, index) => {
    const id = cleanText(typeof item === "string" ? item : item?.id, 64);
    const translatedLabel = id ? cleanText(translateKnownId?.(id), 72) : "";
    const dynamicLabel = typeof item === "object" ? cleanText(item?.label, 72) : "";
    const label = translatedLabel || dynamicLabel;
    const prompt = typeof item === "object"
      ? cleanText(item?.prompt || label, 220)
      : label;

    if (!label || !prompt) return [];

    const dedupeKey = id || `${label.toLowerCase()}::${prompt.toLowerCase()}`;
    if (seen.has(dedupeKey)) return [];
    seen.add(dedupeKey);

    return [{
      id: id || `casepilot-followup-${index + 1}`,
      label,
      prompt
    }];
  }).slice(0, 3);
}
