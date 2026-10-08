// Prüft nach dem Build, dass die Design-Tokens im ausgelieferten CSS stehen.
// Schlägt fehl (Exit 1), wenn z. B. ein veralteter Build-Cache ein altes globals.css liefert.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = ".next/static";
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".css")) files.push(p);
  }
};
walk(root);
const css = files.map((f) => readFileSync(f, "utf8")).join("\n");
const required = [".bg-brand", "--color-purple:", "--color-ink:", "--font-encode", "--color-ink-soft:"];
const forbidden = ["--font-inter", "--color-sun-"];
const missing = required.filter((t) => !css.includes(t));
const stale = forbidden.filter((t) => css.includes(t));
if (missing.length || stale.length) {
  console.error(`CSS-Prüfung fehlgeschlagen. Fehlend: ${missing.join(", ") || "–"}; veraltet: ${stale.join(", ") || "–"}`);
  process.exit(1);
}
console.log(`CSS-Prüfung ok (${files.length} Datei(en)).`);
