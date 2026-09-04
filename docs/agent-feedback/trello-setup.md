# Repointing the feedback sink at another Trello account or board

Operational guide for moving `send-feedback` to a different Trello account, board or list. Written
after doing it on 2026-09-02; every trap listed below cost real time that day.

## What the three variables actually identify

Getting this straight makes the rest obvious — the common mistake is assuming a new account needs a
new key.

| Variable | Identifies | Changes when… |
|---|---|---|
| `TRELLO_API_KEY` | the **application** (a Power-Up), not a person | you want a separate app identity; reusable across accounts |
| `TRELLO_API_TOKEN` | **one user's grant** to that application | **always, when switching accounts** — the token is what decides which boards are visible |
| `TRELLO_LIST_ID` | the **destination list** | you change board or column |

So: switching accounts = **issue a new token**, usually with the same key. Switching lists = change
one variable. The key only needs replacing if you want the reports to come from a different app.

All three must be present or the feature disappears entirely — `trelloConfigured()` is all-or-nothing
by design, so a half-configured server never promises a channel that goes nowhere.

## Step 1 — a token for the target account

Log into Trello **as the account that can see the target board**, then open (substituting the key):

```
https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=Repliers%20MCP&key=<TRELLO_API_KEY>
```

Approve → the page shows the token once. `write` creates cards; `read` is needed to verify them
afterwards, so do not narrow the scope.

If you also need a fresh key: https://trello.com/apps/admin → create a Power-Up (the
**Iframe connector URL** field is mandatory but irrelevant here — any valid https URL will do) →
**API Key** tab → generate.

> **The Power-Up page shows a key *and* a secret. The secret is not a token.** Both are hex blobs of
> similar shape; the secret signs OAuth1 flows and plays no part in the `key` + `token` scheme used
> here. Putting it in `TRELLO_API_TOKEN` yields `Trello responded 401` with nothing pointing at the
> cause.

## Step 2 — find the board and the list id

**The Trello UI does not display list ids anywhere** — there is no "copy id" in the list menu, and
no direct list URL. Every documented route is a workaround. Two of them need no credentials at all,
which matters when whoever configures the server is not the person holding the token.

**From the browser, logged into Trello (no key or token required):**

```
https://trello.com/b/<boardShortLink>.json     ← the whole board
https://trello.com/c/<cardShortLink>.json      ← one card; read its idList
```

The browser authenticates with its session cookie. `Ctrl+F` for the column name; the `"id"` just
above it is the list id. The card variant is far smaller and is the quicker route whenever the
column already holds a card. Pure-clicks equivalent, same payload: board menu → the print/export
section → **Export as JSON**.

`<boardShortLink>` is the segment in the board URL: `https://trello.com/b/<shortLink>/<name>`.

**From the command line, once a key and token exist** — this prints every board the token can see
and the id of each list:

```sh
node -e "
process.loadEnvFile();
(async()=>{
  const q=async p=>{const u=new URL('https://api.trello.com/1'+p);u.searchParams.set('key',process.env.TRELLO_API_KEY);u.searchParams.set('token',process.env.TRELLO_API_TOKEN);const r=await fetch(u);if(!r.ok){console.log('HTTP',r.status,(await r.text()).slice(0,120));return null}return r.json()};
  console.log('authenticated as:',(await q('/members/me?fields=username')).username);
  for(const b of (await q('/members/me/boards?fields=name&filter=open'))||[]){
    console.log('\n'+b.name);
    for(const l of (await q('/boards/'+b.id+'/lists?fields=name'))||[]) console.log('   ',l.id,l.name);
  }
})()"
```

**If the expected board is not listed, it is not necessarily missing.** `/members/me/boards` returns
boards you are a *member* of; a board that is merely visible to a workspace will not appear. Widen
the search before concluding the board does not exist:

```sh
node -e "
process.loadEnvFile();
(async()=>{
  const q=async p=>{const u=new URL('https://api.trello.com/1'+p);u.searchParams.set('key',process.env.TRELLO_API_KEY);u.searchParams.set('token',process.env.TRELLO_API_TOKEN);const r=await fetch(u);return r.ok?r.json():null};
  for(const o of (await q('/members/me/organizations?fields=displayName'))||[]){
    console.log('\n=== '+o.displayName+' ===');
    for(const b of (await q('/organizations/'+o.id+'/boards?fields=name,closed'))||[]) console.log('   ',b.id,b.name,b.closed?'[closed]':'');
  }
})()"
```

Still nothing? Then the board belongs to a different Trello account — go back to step 1 and issue
the token while logged into *that* account. (This is exactly what happened on 2026-09-02: the board
named in planning did not exist under the authenticated account at all, open or closed, in any
workspace.)

The id is the 24-hex string. It is not a secret — unlike the token, it can be pasted into a chat or
a ticket safely.

## Step 3 — write `.env` and restart

```
FEEDBACK_DRY_RUN=false
TRELLO_API_KEY=<key>
TRELLO_API_TOKEN=<token>
TRELLO_LIST_ID=<24-hex list id>
```

**`FEEDBACK_DRY_RUN=true` overrides everything.** With it set, the roster, the instructions and the
nudges all behave as if Trello were configured while `createCard` returns before the network call
and writes to `feedback-cards.log` instead. Perfect credentials plus a forgotten `true` looks like a
working configuration and delivers nothing.

**Restart the server.** The `send-feedback` description and the tool roster are evaluated once per
process, at module import — an `.env` edit alone changes nothing until then.

Confirm the mode before trusting it:

```sh
node -e "process.loadEnvFile();import('./lib/trello.js').then(t=>console.log('dryRun',process.env.FEEDBACK_DRY_RUN==='true','/ configured',t.trelloConfigured()))"
```

## Step 4 — prove it end to end, then clean up

One real card is the only proof that matters. It also verifies the token has `read` scope, which
step 1's `write` alone does not.

```sh
node -e "
process.loadEnvFile();
(async()=>{
  const m=await import('./tools/repliers/repliers-api/custom/send-feedback.js');
  const r=await m.apiTool.function({category:'other',summary:'sink relocation check — delete me',userQuery:'test'});
  console.log(JSON.stringify(r.data));
})()"
```

Expect `{ok:true}` with **no** `dryRun` field, and the card in the intended list. The card's URL is
not in the tool result by design — the server prints it to stderr as `[feedback] card created: …`,
which is where you read it when running this by hand. Then delete it:

```sh
node -e "
process.loadEnvFile();
(async()=>{
  const u=new URL('https://api.trello.com/1/cards/<shortLink from cardUrl>');
  u.searchParams.set('key',process.env.TRELLO_API_KEY);u.searchParams.set('token',process.env.TRELLO_API_TOKEN);
  console.log((await fetch(u,{method:'DELETE'})).status);
})()"
```

For a fuller check — card fidelity, oversized payloads, the failure path, the roster gate — run
[trello-live-check.md](./trello-live-check.md) instead; this step is its T1 only.

## Step 5 — revoke the old token

A token grants `read,write` across **every board of the account that issued it**; the scope cannot
be narrowed to one board. When decommissioning an account, revoke rather than just deleting the
variable: https://trello.com/u/&lt;username&gt;/account → **Applications** → Revoke. A revoked token
answers `401 invalid token`.

## Traps, collected

| Symptom | Cause |
|---|---|
| `401 invalid token`, key looks right | the Power-Up **secret** was used instead of a token |
| `ok:true, dryRun:true`, no card anywhere | `FEEDBACK_DRY_RUN=true` still set |
| `send-feedback` missing from the roster | one of the three variables empty — the gate is all-or-nothing |
| Card created, but T2-style read-back fails | token issued without `read` scope |
| Expected board absent from the listing | not a member of it, or it belongs to another account — widen with the workspace query in step 2 |
| `.env` edited, behaviour unchanged | server not restarted; the roster and tool description are built at import |
| `Trello responded 414` | pre-2026-09-02 code — card content went in the query string; fixed by sending it in the body |
