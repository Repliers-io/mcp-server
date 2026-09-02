# MCP Client Ecosystem Research — Client Selection for Cross-LLM Eval

**Date of research:** 2026-08-28 (all versions/prices verified against official docs and release notes on this date; the ecosystem ships weekly — re-verify before quoting these facts after ~Oct 2026).
**Purpose:** pick the agents/models for running [query-battery.md](./query-battery.md) against `repliers-local`, given the product audience: **non-technical real-estate agents on their computers and phones**.
**Produced by:** a Claude Code session; handed off to the agent running [test-plan.md](./test-plan.md).

## 1. Research method

1. Five parallel research agents, each covering a vendor cluster, instructed to verify against official docs/release notes only and mark anything uncertain as UNVERIFIED rather than guess:
   - OpenAI (Codex CLI, Responses API MCP) / Gemini CLI / Qwen Code
   - GitHub Copilot (VS Code agent mode, Copilot CLI) / Cursor CLI / Cline / Roo Code
   - opencode / Goose / Crush / Aider
   - Amazon Q (now Kiro) / Warp / LM Studio / Mistral
   - Kimi / DeepSeek / xAI Grok / Anthropic Messages API MCP connector / new 2026 entrants
2. Three targeted follow-up web checks on **consumer-surface** gating (grok.com BYO-MCP plan requirements; Gemini consumer app custom connectors; ChatGPT connectors Free-vs-Plus), because the product question shifted from "which CLIs speak MCP" to "where can a realtor plug our connector in".
3. Facts below preserve the original UNVERIFIED markers. Everything else was source-backed on 2026-08-28.

## 2. Headline conclusions

1. **MCP is now table stakes** — of ~25 clients checked, only Aider lacks it. Streamable HTTP is the dominant transport everywhere; SSE is universally marked legacy. Our server's Streamable HTTP endpoint is compatible with every live client below.
2. **The consumer story is asymmetric.** Only Anthropic and xAI let ordinary users attach a custom MCP server for free. OpenAI paywalls it (Plus+, and read/fetch-only on Plus/Pro). Google offers no door at all in the consumer Gemini app.
3. **Recommended eval design — two tracks:**
   - **Track "product"** (what a realtor actually experiences): claude.ai (all plans incl. Free, one custom connector; mobile ✓) and grok.com (BYO MCP since May 2026, free-tier web since ~Jul 28 2026 — one source claims SuperGrok is required: verify empirically; mobile ✓). ChatGPT only if a Plus month is bought (Developer Mode, custom connectors **read/fetch-only** on Plus/Pro — `send-feedback` may be blocked as a write tool; that itself is a product finding). Gemini consumer app: impossible (custom MCP exists only in Gemini Enterprise / Spark launch partners).
   - **Track "model lab"** (which model family handles our tools best, harness held constant): **GitHub Copilot CLI** on the user's existing paid Copilot subscription drives **Claude Sonnet, GPT-5.x, Gemini 3 Pro, and Grok 4.6 from one harness** (`/model` switch), headless, against localhost — the only way to get a "Gemini column" at all, and it isolates model quality from vendor-harness quality. Cross-checking one model between its native surface (track 1) and Copilot (track 2) measures the vendor harness's contribution.
4. Consumer surfaces need a public HTTPS URL (ngrok/cloudflared tunnel to the server's `--http` mode). CLI clients can hit `http://localhost:3001/mcp` (or a second instance on another port) directly.
5. 2025→2026 attrition to be aware of: Roo Code shut down (May 2026, successor ZooCode), iFlow CLI shut down (Apr 2026), Qwen Code's famous free tier discontinued (Apr 15 2026), Warp dropped bundled free AI credits, grok-code-fast-1 free promos ended.

## 3. Consumer surfaces (the four families realtors would use)

| Surface | Custom MCP? | Conditions | Mobile |
|---|---|---|---|
| claude.ai | YES | all plans, incl. Free (Free = one custom connector); Settings > Connectors | iOS/Android ✓ |
| grok.com | YES ("Bring Your Own MCP", May 6 2026) | free-tier web since ~Jul 28 2026 (one conflicting source says SuperGrok — verify); grok.com/connectors > New > Custom > URL | announced Web/iOS/Android |
| ChatGPT | Plus/Pro/Business+ only | Developer Mode (beta, web only); Plus/Pro custom connectors are read/fetch-only; write-capable only on Business/Enterprise/Edu | dev mode web-only |
| Gemini app | NO | no add-a-connector option in consumer app (as of Jul 2026); custom MCP only in Gemini Enterprise and Spark tasks (3 launch partners: Canva, OpenTable, Instacart; no submission process published) | — |

Implication for `send-feedback` on ChatGPT: check our tool annotations (e.g. `readOnlyHint`) — what ChatGPT exposes on Plus may depend on them.

## 4. Client fact sheets (verified 2026-08-28)

### Recommended core (free or already paid, headless, Windows-native)

**Claude Code (Anthropic)** — already in use. stdio/HTTP/SSE; headless `claude -p "..." --allowedTools "mcp__repliers-local__*" --output-format stream-json`; models Opus/Sonnet/Haiku via `--model` = three eval columns from one client.

**Gemini CLI (Google)** — npm `@google/gemini-cli` v0.57.0 (weekly stable, Tuesdays). MCP: stdio / SSE (`url`) / Streamable HTTP (`httpUrl`) in `~/.gemini/settings.json` or `gemini mcp add`. Headless: `gemini -p "..." --yolo --output-format json` (also auto-headless on piped stdin). **Free: personal Google account = 60 req/min, 1,000 req/day, Gemini 3 models** (auto-routed Pro/Flash). Windows native (Node). This is the only free hosted "Gemini column" — the consumer app has no MCP door.

**OpenAI Codex CLI** — npm `@openai/codex` v0.150.1 (Aug 27 2026); Windows native via PowerShell installer (labeled experimental). MCP: stdio + Streamable HTTP (no SSE); `codex mcp add <name> --url <url>`; config `~/.codex/config.toml`. Headless: `codex exec "..." --json` (JSONL events). **Works signed into ChatGPT Free ($0, lowest allowance)** or API key pay-per-token (gpt-5.3-codex $1.75/$14 per MTok). Models: GPT-5.6 family (Sol/Terra/Luna). Bonus: OpenAI "Secure MCP Tunnel" (`openai/tunnel-client`, May 27 2026) exposes localhost MCP to OpenAI's cloud without inbound ports.

**GitHub Copilot CLI** — npm `@github/copilot` v1.0.81 (GA Feb 25 2026); winget/brew/npm; Windows native. MCP: stdio + remote HTTP via `~/.copilot/mcp-config.json` + `/mcp` in-session (MCP spec 2026-07-28 as of v1.0.81). Headless: `copilot -p "..." --allow-all-tools` (granular `--allow-tool`/`--deny-tool`). Cost: included **even in Copilot Free**; paid plans (user has one) unlock premium models. **Models: Claude Opus/Sonnet 4.6, GPT-5.3-Codex (gpt-5.4 default), Gemini 3 Pro, Grok 4.6 — switch with `/model`** → the "model lab" harness. Usage bills AI Credits (~1,500/mo on Pro; 28-query battery × 4 models should fit — watch the balance). Note: org-level "MCP servers in Copilot" policy is NOT enforced in the CLI (individual plans unaffected anyway).

**Cline CLI** — npm `cline` v3.0.60 (CLI 2.0, Feb 13 2026); VS Code ext `saoudrizwan.claude-dev` v4.1.16; Windows-native binaries. MCP: stdio / SSE / `streamableHttp` in `~/.cline/mcp.json` (`cline mcp` subcommand). Headless: `cline --json "task"`, `--auto-approve true`; headless auto-triggers on piped stdin. **True $0 path: OpenRouter `:free` models (~28 models, no card; ~20 req/min, 50–200 req/day)** — the cheap way to add open-weights columns without local hardware. Security note: pin versions in CI (2026 npm supply-chain incident with a malicious `cline@2.3.0`).

### Second tier (viable, with caveats)

- **Goose** (Linux Foundation AAIF, ex-Block; docs moved to goose-docs.ai) — v1.48.0. Deepest MCP integration (extensions ARE MCP servers). stdio / SSE / `streamable_http` (underscore!). Headless: `goose run -t "..." --output-format json`, `--with-streamable-http-extension <url>`. Free tool; BYO key or Ollama. Windows native since 2026.
- **opencode** (Anomaly, ex-SST; repo anomalyco/opencode) — npm `opencode-ai` v1.18.25 (near-daily releases). MCP local/remote (Streamable HTTP with SSE fallback; Aug 2026 issues show remaining handshake rough edges). Headless: `opencode run "..." --format json`; also `opencode serve` HTTP API. 75+ providers; Windows native but WSL officially recommended.
- **Crush** (Charm) — v0.91.2; winget/scoop; Windows first-class. MCP stdio/http/sse in `crush.json` (OAuth since v0.87.0). Headless `crush run` + `--yolo`, but **no JSON output format** → weaker for automated grading. FSL license.
- **Mistral Vibe** — pip `mistral-vibe` v2.24.5 (Python 3.12+); Apache 2.0. MCP stdio/http/streamable-http in `config.toml [[mcp_servers]]`. Headless: `vibe --prompt "..."`, `--auto-approve`, `--max-price`. Inference on **free rate-limited Experiment tier** API keys. Windows: pip-likely, not officially documented (UNVERIFIED). Devstral 2 models. Note: Le Chat (consumer) also accepts custom MCP connectors on Free — a possible fifth consumer surface if ever relevant.
- **DeepSeek dsh** (`deepseek-ai/deepseek-harness`) — npm `@deepseek-ai/dsh` (npx; Node 22.19+), MIT, **developer preview** with breaking changes promised. MCP stdio + streamable-http (tools only; no resources/prompts). Headless: `dsh --profile headless "..."`. V4 models (flash/pro), very cheap ($0.22–0.66 in / $0.66–1.98 out per MTok off-peak; no free tier). Old `deepseek-chat`/`deepseek-reasoner` aliases retired Jul 24 2026.
- **LM Studio** — v0.4.21; free incl. work use; local open-weights (Qwen3, gpt-oss, Llama, GLM, Kimi K2…). MCP host since 0.3.17; headless MCP via `llmster` daemon + stateful REST `/api/v1/chat` (0.4.0+, permission keys; `ephemeral_mcp` per-request or `plugin` referencing `~/.lmstudio/mcp.json`). Caveat: remote transport was SSE-based, Streamable HTTP reliability UNVERIFIED (bug #1453). The OpenAI-compatible `/v1/*` endpoints do NOT use mcp.json.
- **Pure-API baselines ("zero harness"):** Anthropic Messages API MCP connector — beta header **`anthropic-beta: mcp-client-2025-11-20`** (old 2025-04-04 deprecated), `mcp_servers:[{type:"url",...}]` + required `{type:"mcp_toolset", mcp_server_name}` in `tools`; URL-only (https, public → ngrok), tools only, normal token pricing, not on Bedrock/Vertex. OpenAI Responses API — `tools:[{type:"mcp", server_url,...}]`, Streamable HTTP or SSE, public URL or Secure MCP Tunnel, token pricing. xAI API Remote MCP Tools — same shape, Streamable HTTP/SSE. These show raw model×tools behavior with no agent harness; useful as a control.

### Excluded, with reasons

| Client | Reason |
|---|---|
| Qwen Code (npm `@qwen-code/qwen-code` v0.22.2) | free tier (2,000/day → 100/day) **discontinued Apr 15 2026** (issue #3203); BYO key only |
| Cursor CLI (`agent`, renamed from `cursor-agent` Jan 2026) | headless fine (`agent -p --output-format json`) but MCP availability on free Hobby plan UNVERIFIED; no BYO-key mode |
| Kiro CLI (ex-Amazon Q CLI, renamed Nov 17 2025; v2.20.0) | MCP on all tiers, Windows-native since 2.0, but **headless (`kiro-cli chat --no-interactive`) requires an API key = paid tiers only** |
| Warp Agent CLI (`warp`, Aug 4 2026) | new CLI has **no documented print/exec mode**; free plan has no bundled AI credits; deprecated `oz agent run` is the only headless path |
| Grok Build CLI (`grok -p`) | subscription-only (SuperGrok / X Premium+); no API-key mode. (Grok as a model is still covered via Copilot CLI and grok.com.) |
| Kimi Code CLI (Moonshot, v0.39.1; ex kimi-cli) | full MCP + headless (`kimi --print`), but subscription (~$19+/mo) or pay-per-token only |
| Factory Droid (`droid exec`, v0.199.0) | subscription-only ($20+/mo); Windows-native UNVERIFIED |
| Roo Code | **shut down May 15 2026**; repo archived; successor: ZooCode (`ZooCodeOrganization.zoo-code`) or Cline |
| Aider (pip `aider-chat` v0.86.2) | never merged MCP (issue #3314, PRs closed unmerged); semi-dormant since Feb 2026 |
| iFlow CLI | shut down Apr 17 2026 |
| VS Code Copilot agent mode | MCP GA (VS Code 1.102+, `.vscode/mcp.json` with top-level `"servers"` key) but interactive-only — no headless automation |
| Google Antigravity (`agy`) / Jules | Antigravity: MCP stdio+HTTP, free for individuals, but headless specifics only partially documented; Jules: MCP = managed integrations only, not arbitrary servers. Revisit later |

## 5. Suggested next actions for the eval agent

1. Keep [test-plan.md](./test-plan.md) Part B on Claude Code as written (in progress).
2. For [query-battery.md](./query-battery.md): run Track "model lab" via Copilot CLI (localhost MCP config, 4 models × 28 queries, `copilot -p` per cold query) and Track "product" manually on claude.ai + grok.com through an ngrok tunnel; log per the battery's results template.
3. Empirically resolve the two cheap unknowns: does grok.com BYO-MCP work on the free tier; what does ChatGPT Plus Developer Mode show of our roster (read-only filtering vs `send-feedback`).
4. Pin exact client versions in the results log — Codex/Copilot/opencode released new versions the very week of this research.

## 6. Primary sources

Codex: developers.openai.com/codex/noninteractive · github.com/openai/codex · learn.chatgpt.com/docs/extend/mcp. Responses MCP: developers.openai.com/api/docs/guides/tools-connectors-mcp · …/secure-mcp-tunnels. Gemini CLI: github.com/google-gemini/gemini-cli (docs/tools/mcp-server.md, docs/cli/headless.md) · geminicli.com/docs/resources/quota-and-pricing. Qwen: github.com/QwenLM/qwen-code (+issue #3203). Copilot: docs.github.com/en/copilot/reference/copilot-cli-reference/cli-programmatic-reference · github.blog/changelog/2026-02-25 · github.com/features/copilot/plans · code.visualstudio.com/docs/copilot/customization/mcp-servers. Cursor: cursor.com/docs/cli/{overview,headless,mcp}. Cline: docs.cline.bot/mcp/configuring-mcp-servers · cline.bot/blog/introducing-cline-cli-2-0. Roo→Zoo: github.com/RooCodeInc/Roo-Code (archive notice) · zoocode.dev. opencode: opencode.ai/docs/mcp-servers · github.com/anomalyco/opencode. Goose: goose-docs.ai/docs/guides/goose-cli-commands. Crush: github.com/charmbracelet/crush · charmbracelet-crush.mintlify.app. Aider: github.com/Aider-AI/aider/issues/3314. Kiro: kiro.dev/docs/cli/headless · kiro.dev/docs/mcp · kiro.dev/pricing. Warp: docs.warp.dev/agents/cli/reference · warp.dev/pricing. LM Studio: lmstudio.ai/docs/app/mcp · lmstudio.ai/blog/0.4.0 · bug #1453. Mistral: docs.mistral.ai/agents/mcp · github.com/mistralai/mistral-vibe · mistral.ai/news/le-chat-mcp-connectors-memories. Kimi: github.com/MoonshotAI/kimi-code · kimi.com/code/docs. DeepSeek: github.com/deepseek-ai/deepseek-harness · api-docs.deepseek.com/quick_start/pricing. xAI: docs.x.ai/developers/tools/remote-mcp · docs.x.ai/grok/connectors · x.ai/news/grok-build-cli. Anthropic: platform.claude.com/docs/en/agents-and-tools/mcp-connector. Consumer gating: coworker.ai/blog/chatgpt-mcp · support.google.com/gemini/thread/364779684 · usecarly.com/blog/claude-mcp · github.com/rdmgator12/awesome-grok-connectors.
