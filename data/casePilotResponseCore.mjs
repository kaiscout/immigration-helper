export function shouldCountCasePilotQuestion(data) {
  return Boolean(
    casePilotResponseText(data) &&
    data?.degraded !== true &&
    data?.answer_profile?.degraded !== true
  );
}
export function casePilotResponseText(data, fallback = "") {
  const text = typeof data?.output_text === "string" && data.output_text.trim()
    ? data.output_text.trim()
    : (Array.isArray(data?.output) ? data.output : [])
      .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
      .filter((content) => content?.type === "output_text" && typeof content.text === "string")
      .map((content) => content.text.trim())
      .filter(Boolean)
      .join("\n\n");

  const cleaned = (text || fallback)
    .replace(/(?:cite|filecite)[^]+/g, "")
    .replace(/\s*\(\s*\[\s*\]\(\s*\)\s*\)/g, "")
    .replace(/\[\s*\]\(\s*(?:https?:\/\/[^)]*)?\s*\)/g, "")
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1")
    .replace(/\s*\((?:[a-z0-9-]+\.)*(?:uscis|state|cbp|dhs|ice|justice|dol)\.gov\)/gi, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || fallback;
}
