#!/usr/bin/env node
/** Capacitor 8 defaults to Java 21; patch to 17 when only JDK 17 is available. */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    try {
      const st = statSync(p);
      if (st.isDirectory()) walk(p, out);
      else if (name.endsWith(".gradle")) out.push(p);
    } catch { /* ignore */ }
  }
  return out;
}

const roots = [
  "node_modules/@capacitor",
  "android",
].filter(Boolean);

let n = 0;
for (const root of roots) {
  try {
    for (const f of walk(root)) {
      let t = readFileSync(f, "utf8");
      const next = t
        .replaceAll("JavaVersion.VERSION_21", "JavaVersion.VERSION_17")
        .replaceAll("jvmToolchain(21)", "jvmToolchain(17)");
      if (next !== t) {
        writeFileSync(f, next);
        n++;
      }
    }
  } catch { /* root missing */ }
}
console.log(`Patched ${n} gradle files to Java 17`);
