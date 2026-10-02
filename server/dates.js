import fs from "fs";
import path from "path";

// Dates in frontmatter use config.yaml's wiki.date_format (YYYY, MM, DD tokens).
// Dependency-free so the SessionStart hook can import it without node_modules.

export function readDateFormat(wikiPath) {
  try {
    const raw = fs.readFileSync(path.join(wikiPath, "config.yaml"), "utf8");
    return raw.match(/date_format:\s*["']?([^"'\n#]+)["']?/)?.[1]?.trim() || "MM/DD/YYYY";
  } catch { return "MM/DD/YYYY"; }
}

export function formatDate(d, fmt) {
  const yyyy = d.getFullYear().toString();
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return fmt.replace("YYYY", yyyy).replace("MM", mm).replace("DD", dd);
}

export const isoDate = (d) => formatDate(d, "YYYY-MM-DD");

// Parse a date written in `fmt`; ISO YYYY-MM-DD is always accepted too. null if unparseable.
export function parseDate(str, fmt) {
  if (!str) return null;
  const s = String(str).trim().replace(/^["']|["']$/g, "");
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const order = [];
  const re = fmt.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&").replace(/YYYY|MM|DD/g, (t) => {
    order.push(t);
    return t === "YYYY" ? "(\\d{4})" : "(\\d{1,2})";
  });
  const m = s.match(new RegExp(`^${re}`));
  if (!m) return null;
  const v = Object.fromEntries(order.map((t, i) => [t, +m[i + 1]]));
  return new Date(v.YYYY, v.MM - 1, v.DD);
}

// `created:` / `updated:` from a markdown file's frontmatter, without a YAML dependency.
export function frontmatterDates(text, fmt) {
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || "";
  const get = (k) => parseDate(fm.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1], fmt);
  return { created: get("created"), updated: get("updated") };
}
