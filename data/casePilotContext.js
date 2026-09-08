const MESSAGE_MAX_LENGTH = 900;
const USER_CONTEXT_MESSAGE_LIMIT = 12;
const OMITTED_MIDDLE_MARKER = " … ";

const cleanMessageText = (value, maxLength = MESSAGE_MAX_LENGTH) => {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxLength) return normalized;

  // Intake facts tend to appear near the beginning of a message while a
  // correction or the assistant's focused follow-up question often appears at
  // the end. Keep both instead of silently discarding either side.
  const availableCharacters = Math.max(0, maxLength - OMITTED_MIDDLE_MARKER.length);
  const headLength = Math.ceil(availableCharacters * 0.6);
  const tailLength = availableCharacters - headLength;
  return `${normalized.slice(0, headLength).trimEnd()}${OMITTED_MIDDLE_MARKER}${normalized
    .slice(-tailLength)
    .trimStart()}`;
};

function anchorAndRecentUserMessages(messages, limit = USER_CONTEXT_MESSAGE_LIMIT) {
  if (messages.length <= limit) return messages;

  // Keep the first user statement as the intake anchor and devote the rest of
  // the bounded window to the newest corrections and follow-ups.
  return [messages[0], ...messages.slice(-(limit - 1))];
}

function newestLinesWithinBudget(lines, maxCharacters) {
  const selected = [];
  let characters = 0;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const cost = line.length + (selected.length ? 1 : 0);
    if (characters + cost > maxCharacters) break;
    selected.unshift(line);
    characters += cost;
  }

  return selected.join("\n");
}

export function buildCasePilotRequestContext(messages, currentUserMessage) {
  const history = Array.isArray(messages) ? messages : [];
  const conversationLines = history
    .slice(-8)
    .map((message) => {
      const text = cleanMessageText(message?.text);
      if (!text) return "";
      return `${message?.role === "user" ? "User" : "Assistant"}: ${text}`;
    })
    .filter(Boolean);

  const userMessages = [...history, currentUserMessage]
    .filter((message) => message?.role === "user")
    .filter((message) => cleanMessageText(message?.text));
  const userLines = anchorAndRecentUserMessages(userMessages)
    .map((message) => cleanMessageText(message?.text))
    .filter(Boolean)
    .map((text) => `User statement: ${text}`);

  return {
    conversation: newestLinesWithinBudget(conversationLines, 8_000),
    userContext: newestLinesWithinBudget(userLines, 12_000)
  };
}
