#!/usr/bin/env node
// Install and launch the Blink menubar app. If Blink.app isn't in /Applications,
// download the latest signed DMG from the GitHub release and install it, then
// open it. `blink-app update` forces a re-download.
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { get } from "node:https";

const REPO = "arach/blink";
const APP_PATH = "/Applications/Blink.app";
const BUNDLE_ID = "dev.arach.blink";

function httpsGet(url) {
  return new Promise((resolvePromise, reject) => {
    get(url, { headers: { "User-Agent": "blink" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolvePromise, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      resolvePromise(res);
    }).on("error", reject);
  });
}

async function downloadTo(url, dest) {
  const res = await httpsGet(url);
  await new Promise((resolvePromise, reject) => {
    const ws = createWriteStream(dest);
    res.pipe(ws);
    ws.on("finish", resolvePromise);
    ws.on("error", reject);
  });
}

async function latestDmgUrl() {
  const res = await httpsGet(`https://api.github.com/repos/${REPO}/releases/latest`);
  const chunks = [];
  for await (const chunk of res) chunks.push(chunk);
  const release = JSON.parse(Buffer.concat(chunks).toString());
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const dmg = assets.find((a) => a.name.endsWith(".dmg"));
  if (!dmg) throw new Error("no .dmg asset in the latest release");
  return dmg.browser_download_url;
}

function installFromDmg(dmgPath) {
  const mount = mkdtempSync(join(tmpdir(), "blink-mount-"));
  try {
    execSync(`hdiutil attach -nobrowse -readonly -mountpoint '${mount}' '${dmgPath}'`, { stdio: "pipe" });
    const mounted = resolve(mount, "Blink.app");
    if (!existsSync(mounted)) throw new Error("Blink.app not found in DMG");
    rmSync(APP_PATH, { recursive: true, force: true });
    execSync(`cp -R '${mounted}' '${APP_PATH}'`);
  } finally {
    try { execSync(`hdiutil detach '${mount}' -quiet`, { stdio: "pipe" }); } catch {}
    rmSync(mount, { recursive: true, force: true });
  }
}

async function ensureInstalled(force) {
  if (existsSync(APP_PATH) && !force) return;
  console.log(force ? "Updating Blink.app…" : "Installing Blink.app from the latest release…");
  const url = await latestDmgUrl();
  const dir = mkdtempSync(join(tmpdir(), "blink-dl-"));
  const dmg = join(dir, "Blink.dmg");
  try {
    await downloadTo(url, dmg);
    installFromDmg(dmg);
    console.log(`Installed ${APP_PATH}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function launch() {
  execFileSync("open", ["-b", BUNDLE_ID], { stdio: "inherit" });
  console.log("Blink launched (menubar).");
}

if (process.platform !== "darwin") {
  console.error("@arach/blink runs on macOS only.");
  process.exit(1);
}

const cmd = process.argv[2];
try {
  if (cmd === "update") {
    await ensureInstalled(true);
    launch();
  } else if (cmd === "path") {
    console.log(APP_PATH);
  } else {
    await ensureInstalled(false);
    launch();
  }
} catch (error) {
  console.error(`blink-app: ${error.message}`);
  console.error(`Download manually: https://github.com/${REPO}/releases/latest`);
  process.exit(1);
}
