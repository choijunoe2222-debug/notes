import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

function errorDetails(cause: unknown) {
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message, stack: cause.stack };
  }
  return { message: String(cause) };
}

function runtimeDetails() {
  const chromiumBin = path.join(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin");
  return {
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    vercel: Boolean(process.env.VERCEL),
    chromiumBin,
    chromiumBinExists: fs.existsSync(chromiumBin),
    tempDirectory: os.tmpdir(),
  };
}

function localChromePath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  return candidates.find((candidate): candidate is string => Boolean(candidate && fs.existsSync(candidate)));
}

export async function launchBrowser() {
  const localPath = localChromePath();
  chromium.setGraphicsMode = false;

  let executablePath: string;
  try {
    executablePath = localPath ?? (await chromium.executablePath());
  } catch (cause) {
    console.error("[pdf] Chromium executable resolution failed", {
      ...runtimeDetails(),
      cause: errorDetails(cause),
    });
    throw new Error("Chromium executable resolution failed", { cause });
  }

  if (!fs.existsSync(executablePath)) {
    console.error("[pdf] Chromium executable is missing", {
      ...runtimeDetails(),
      executablePath,
    });
    throw new Error("Chromium executable is missing");
  }

  try {
    return await puppeteer.launch({
      executablePath,
      args: localPath ? ["--no-sandbox", "--disable-setuid-sandbox"] : chromium.args,
      headless: true,
      defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      timeout: 30_000,
    });
  } catch (cause) {
    console.error("[pdf] Chromium launch failed", {
      ...runtimeDetails(),
      executablePath,
      cause: errorDetails(cause),
    });
    throw new Error("Chromium launch failed", { cause });
  }
}
