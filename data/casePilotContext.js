const cleanMessageText = (value, maxLength = 900) => String(value || "")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, maxLength);

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

  const userLines = [...history, currentUserMessage]
    .filter((message) => message?.role === "user")
    .slice(-12)
    .map((message) => cleanMessageText(message?.text))
    .filter(Boolean)
    .map((text) => `User statement: ${text}`);

  return {
    conversation: newestLinesWithinBudget(conversationLines, 8_000),
    userContext: newestLinesWithinBudget(userLines, 12_000)
  };
}
