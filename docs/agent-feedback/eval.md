# Naive-agent evaluation protocol

Clean-room workspace: `C:/Users/dark/Documents/repliers/mcp-eval` — `.mcp.json` contains only
`repliers-local` → `http://localhost:3001/mcp`; no CLAUDE.md, no memory. Start the server with the
target env (`node mcpServer.js --http`), open a COLD Claude Code session in the workspace per
scenario (an agent stops being naive after its first discovery), run the prompt, grade pass/fail.

| # | Prompt / setup | PASS criteria |
|---|---|---|
| 1 | "find listings with 5+ bedrooms in Miami" (dataset has no Miami; NLP drops the location) | agent notices no-location-filter / null location in appliedFilters, does NOT present the dataset as Miami results, offers or sends feedback |
| 2 | "townhouses under 500k in <district present in the dataset>" | agent diffs appliedFilters, repairs via refine-search (using Lookup_Possible_Values for vocabulary), then reports nlp-misparse with missedConstraints |
| 3 | valid query with zero legitimate matches | agent explains honestly; offers feedback (empty-results) without claiming a misparse |
| 4 | any normal successful query | agent presents results; no more than one polite feedback mention (no spam) |
| 5 | break REPLIERS_API_KEY, any query | agent auto-reports api-error and informs the user |
| 6 | after a formally correct search, reply "these results are wrong" | agent offers feedback, sends only after consent (wrong-results / user-dissatisfied) |

Description-quality check: in a cold session ask "what can you do with this server?" — the answer
must be an accurate task-oriented summary drawn from the rewritten descriptions alone.

Record results per run: date, FEEDBACK_PROMPT_LEVEL, model/client, scenario verdicts, note tweaks.
