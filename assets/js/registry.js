/**
 * Tool registry — the dashboard (index.html) renders one card per entry.
 *
 * TO ADD A NEW TOOL:
 *   1. Build the page at tools/<your-tool>.html (copy tools/taobao-link-fixer.html
 *      as a starting template — it already wires up the shared header/footer/css).
 *   2. Add an object to the TOOLS array below.
 *   3. Commit + push. The dashboard picks it up automatically, no other changes needed.
 */

const TOOLS = [
  {
    id: "taobao-link-fixer",
    name: "Taobao Link Fixer",
    icon: "🔗",
    description:
      "Paste a world.taobao.com / Tmall link and get back the canonical item.taobao.com/item.htm?id= link your purchasing agent needs.",
    url: "tools/taobao-link-fixer.html",
    tags: ["taobao", "links", "purchasing"],
  },

  // Next tool goes here, e.g.:
  // {
  //   id: "example-tool",
  //   name: "Example Tool",
  //   icon: "✨",
  //   description: "Short description of what it does.",
  //   url: "tools/example-tool.html",
  //   tags: ["example"],
  // },
];
