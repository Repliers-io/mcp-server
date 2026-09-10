# PropelAuth MCP Auth — what we need from the tenant

**For:** whoever administers the `auth.repliers.com` PropelAuth tenant
**From:** the team modifying the Repliers MCP server
**Date:** 2026-09-09
**Status:** our work is finished and tested; it cannot go further until this is done

This is a self-contained extract. The full design is [design.md](design.md); nothing here
requires reading it.

---

## Why

Command-line and desktop MCP clients — Claude Code, Claude Desktop, Codex — cannot log into
the hosted MCP server at `mcp.repliers.io` at all today. Each login opens a fresh loopback
callback on a random port *and* path, which a static redirect-URI whitelist cannot
accommodate. The claude.ai connector works only because it is one fixed URL.

The fix is to stop having the MCP server impersonate an authorization server and let
PropelAuth be one — which is what the MCP Auth feature exists for. Our side is written,
reviewed and green. It has never spoken to a real PropelAuth MCP authorization server,
because the feature is off:

```
$ curl -sI https://auth.repliers.com/.well-known/oauth-authorization-server/oauth/2.1
404
```

Measured again on 2026-09-09. Every `/oauth/2.1` address on the tenant returns 404.

## MCP Auth is not the OIDC login the tenant already runs

The tenant already serves an OIDC login for other Repliers applications. **MCP Auth is a
separate dashboard feature.** A previous attempt enabled something adjacent: it looked
complete in the dashboard while the address above still returned 404. §3 is the check that
tells the two apart — please run it rather than reporting from the dashboard UI.

---

## 1. Checklist

1. **MCP → Enable MCP.** If the tenant has a Test/Staging environment, do it there first —
   we would rather meet the surprises off production.
2. **Enable Dynamic Client Registration.** Without it, CLI and desktop clients still cannot
   log in, which is the entire point of the exercise.
3. **Whitelist MCP clients:** the Claude / ChatGPT / Cursor templates, plus loopback
   `http://127.0.0.1:*/callback`.
4. **Request Validation → Create Credentials.** Send us the Client ID and Secret — see §4.
5. **Set the session duration policy.**

## 2. Questions only the dashboard can answer

Please answer these along with the credentials. Two of them decide whether we need to change
code before deploying, so a guess is worse than "I don't know".

| # | Question | What it decides |
|---|---|---|
| **Q10** | Is DCR open, or gated behind an initial access token — and does the redirect-URI whitelist still apply to dynamically registered clients? | If the whitelist applies to DCR too, loopback callbacks fail again and we are back at today's breakage by a new route. Highest risk on this page |
| Q11 | Is there a rate limit on `POST /oauth/2.1/introspect`, and what is it? | We validate every token against that endpoint and cache the verdict for 60s. That number is currently a guess |
| Q12 | Does enabling MCP Auth disturb the existing OIDC login used by other Repliers applications on this tenant? | We believe it does not — different subsystem — but we have not verified it, and this is a shared production tenant. If a Test environment exists, this is the reason to use it first |

## 3. Verification — please run this, both must pass

```sh
curl -sI https://auth.repliers.com/.well-known/oauth-authorization-server/oauth/2.1

curl -s https://auth.repliers.com/.well-known/oauth-authorization-server/oauth/2.1 \
  | jq .registration_endpoint
```

Expected: **200** from the first, and a **non-empty URL** from the second.

If the first returns 404, MCP Auth is not on — regardless of what the dashboard shows. If the
second is `null`, MCP Auth is on but DCR (checklist item 2) is not, and CLI clients still
cannot log in.

For a Test/Staging environment, substitute its auth URL in both commands.

## 4. What to send back

| Item | Notes |
|---|---|
| Introspection **Client ID** and **Secret** from checklist item 4 | Through a secret manager or password vault, please — not email or chat |
| The output of both commands in §3 | Verbatim, including which environment it was run against |
| Answers to **Q9–Q12** | §2 |
| Confirmation that the existing `PROPELAUTH_API_KEY` still reads user metadata | We use it to look up each user's `repliers_api_key`; it is unchanged by this work, but a startup check now depends on it |

## 5. The other half — the deployment environment

We do not have access to the environment of `mcp.repliers.io`. **If it is not yours either,
please point us at whoever owns it** — we need that person before the cutover, not on the day
of it. Nothing below blocks the checklist above; both can proceed in parallel.

**One thing worth checking straight away:** `REPLIERS_API_KEY` must **not** be set in that
environment. It switches the server into self-hosted mode, where every caller is served with one
shared key and authentication is skipped entirely. This is true of the currently deployed version
too, so it is worth a look regardless of this migration.

The new variables to set — including the introspection credentials from checklist item 4 — we
will hand over at the cutover.

## 6. What happens next, and what is safe

Completing this checklist is **safe for the live claude.ai connector** — subject to Q12. The
deployed server is unchanged and keeps using the old flow; enabling MCP Auth only makes new
endpoints exist alongside it.

What is *not* safe is the reverse order, and that part is on us: the moment our new server
publishes its metadata, clients prefer PropelAuth's discovery over the shim we are deleting.
If the tenant is not ready at that moment, the one flow that works today breaks along with
everything else. So:

```
dashboard  →  §3 verification  →  our probe + one real login  →  we deploy  →  connectors re-authorize once
```

We will not deploy anything until we have run our own probe against the live tenant and read
one real introspection response. If that probe fails, we come back to you rather than
shipping.

**One user-visible consequence, for support:** every existing claude.ai connector will ask
its user to log in once more after the cutover. Nothing else changes for them, and no
Repliers API key needs re-issuing.
