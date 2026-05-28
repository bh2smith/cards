import { cpSync, mkdirSync } from "fs";

const result = await Bun.build({
  entrypoints: ["./src/main.ts"],
  outdir: "./dist",
  minify: true,
  target: "browser",
});

if (!result.success) {
  console.error("Build failed:");
  for (const msg of result.logs) {
    console.error(msg);
  }
  process.exit(1);
}

const cssResult = await Bun.build({
  entrypoints: ["./src/style.css"],
  outdir: "./dist",
  minify: true,
});

if (!cssResult.success) {
  console.error("CSS build failed:");
  for (const msg of cssResult.logs) {
    console.error(msg);
  }
  process.exit(1);
}

const html = await Bun.file("./src/index.html").text();
const distHtml = html
  .replace('src="./main.ts"', 'src="./main.js"')
  .replace('href="./style.css"', 'href="./style.css"');

await Bun.write("./dist/index.html", distHtml);

cpSync("./src/manifest.json", "./dist/manifest.json");
cpSync("./src/sw.js", "./dist/sw.js");
cpSync("./src/icon.svg", "./dist/icon.svg");
mkdirSync("./dist/assets", { recursive: true });
cpSync("./src/assets/svg-cards.svg", "./dist/assets/svg-cards.svg");

console.log("Build complete → dist/");
