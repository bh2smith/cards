import index from "./src/index.html";

Bun.serve({
  port: 3000,
  routes: {
    "/": index,
    "/manifest.json": new Response(Bun.file("src/manifest.json")),
    "/sw.js": new Response(Bun.file("src/sw.js"), {
      headers: { "Content-Type": "application/javascript" },
    }),
    "/icon.svg": new Response(Bun.file("src/icon.svg"), {
      headers: { "Content-Type": "image/svg+xml" },
    }),
    "/assets/svg-cards.svg": new Response(
      Bun.file("src/assets/svg-cards.svg"),
      {
        headers: { "Content-Type": "image/svg+xml" },
      },
    ),
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log("Dev server running at http://localhost:3000");
