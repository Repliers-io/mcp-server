// Trello caps a card description at 16,384 characters.
const maxDescLength = 16384;

const markers = {
  "nlp-misparse": "🧩",
  "empty-results": "∅",
  "wrong-results": "🎯",
  "api-error": "❌",
  "user-dissatisfied": "💬",
  other: "📎",
};

const truncate = (text, max = 80) => (text.length > max ? `${text.slice(0, max)}…` : text);

export function buildFeedbackCard(feedback) {
  const { category, summary, userQuery, missedConstraints, toolCalls, nlpId, expected } = feedback;
  const name = `[MCP] ${markers[category] || markers.other} ${truncate(summary)}`;
  const lines = [
    `**Category:** ${category}`,
    `**Summary:** ${summary}`,
    `**User query:** ${userQuery}`,
    expected ? `**Expected:** ${expected}` : null,
    nlpId ? `**nlpId:** ${nlpId}` : null,
    missedConstraints?.length
      ? [
          "",
          "**Missed constraints:**",
          ...missedConstraints.map(
            (c) => `- ${c.constraint}: requested \`${c.requested}\` → applied \`${c.applied}\``
          ),
        ].join("\n")
      : null,
    toolCalls?.length
      ? ["", "**Tool calls:**", "```json", JSON.stringify(toolCalls, null, 2), "```"].join("\n")
      : null,
    "",
    `_Reported ${new Date().toISOString()}_`,
  ].filter((line) => line !== null);
  // Hard cap at the Trello limit; the summary sits first so it always survives.
  return { name, desc: lines.join("\n").slice(0, maxDescLength) };
}
