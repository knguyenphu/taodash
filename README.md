# Agent Toolbox

A small, static, no-build-step dashboard of personal utilities, hosted for free on GitHub
Pages. Currently ships with one tool:

- **Taobao Link Fixer** — pastes a `world.taobao.com` / Tmall / Taobao link and returns the
  canonical `https://item.taobao.com/item.htm?id=<id>` link that a purchasing agent needs.

The dashboard is built so new tools are a two-file, one-array addition — no framework, no
build tooling, just plain HTML/CSS/JS.

## Host it on GitHub Pages

1. Create a new **empty** repo on GitHub (don't let it auto-add a README/license — this
   folder already has one). Call it whatever you like, e.g. `agent-toolbox`.
2. From inside this folder:

   ```bash
   git remote add origin https://github.com/<your-username>/agent-toolbox.git
   git branch -M main
   git push -u origin main
   ```

   (If you unzipped this folder fresh, it already has an initial commit — you only need to
   add the remote and push.)

3. On GitHub: **Settings → Pages → Source → Deploy from a branch → Branch: `main`, folder:
   `/ (root)` → Save**.
4. After a minute or two, your dashboard is live at:

   ```
   https://<your-username>.github.io/agent-toolbox/
   ```

No server, no API keys, nothing to configure — it's a static site.

## How the Taobao Link Fixer works

Taobao/Tmall links show up in a few shapes:

- `item.taobao.com/item.htm?id=925435367253` — already correct, used as-is.
- `detail.tmall.com/item.htm?id=925435367253` — same `id` param, just re-based to
  `item.taobao.com`.
- `world.taobao.com/item/<opaque-token>.htm` — the cross-border storefront. The token in the
  URL is **not** a reversible encoding of the numeric item id (it's an internal opaque
  slug), so it can't be decoded client-side from the URL alone.

For that last case, the tool fetches the live page through a public CORS proxy
(`corsproxy.io`, falling back to `allorigins.win`) and reads the real
`item.taobao.com/item.htm?id=...` link that the storefront page always embeds internally
(for its own tracking/cross-links). This step only works once the site is served over
`http(s)` — e.g. after you've pushed it to GitHub Pages — not when opening `index.html`
directly from disk.

If both proxies are down or blocked, the tool reports a failure rather than guessing — at
that point the fallback is to open the link yourself and copy the id out of the page (the
same `item.taobao.com/item.htm?id=` link is usually visible in the page's "buy" / "cart"
buttons).

## Adding a new tool

1. Copy `tools/taobao-link-fixer.html` as a starting template — it already wires up the
   shared header, footer, and `assets/css/style.css`.
2. Build your tool's UI/logic in the new file (put shared JS logic in its own file under
   `assets/js/` if it's more than a few lines, same pattern as `taobao-fixer.js`).
3. Add one entry to the `TOOLS` array in `assets/js/registry.js`:

   ```js
   {
     id: "my-new-tool",
     name: "My New Tool",
     icon: "✨",
     description: "One-line description shown on the dashboard card.",
     url: "tools/my-new-tool.html",
     tags: ["example"],
   }
   ```

4. Commit and push. The dashboard card appears automatically — no other changes needed.

## Project structure

```
agent-toolbox/
├── index.html                    # Dashboard — renders cards from registry.js
├── assets/
│   ├── css/style.css             # Shared styling (light/dark aware)
│   └── js/
│       ├── registry.js           # List of tools shown on the dashboard
│       └── taobao-fixer.js       # Link-fixing logic for the Taobao tool
├── tools/
│   └── taobao-link-fixer.html    # The Taobao Link Fixer tool page
└── README.md
```
