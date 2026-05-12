/**
 * Isyweb — Tier 2 (Proxy with Playwright) + Tier 3 (Screenshots)
 *
 * Standalone Fastify server that complements the Next.js app. Deployed
 * separately (Railway / Fly.io) because Playwright requires a Chromium
 * binary that doesn't fit Vercel's serverless runtime.
 *
 * Endpoints:
 *   GET  /health                       — liveness probe
 *   POST /proxy   {url, projectKey}    — Tier 2: fetch the dev site through
 *                                        a headless browser, strip CSP &
 *                                        X-Frame-Options, inject the widget,
 *                                        return rewritten HTML
 *   POST /screenshot                   — Tier 3: capture full-page screenshot
 *                                        at desktop/tablet/mobile and return
 *                                        as image bytes
 *
 * Auth: requires header `Authorization: Bearer ${PROXY_SHARED_SECRET}`
 * matching env var set on both this server and the Next.js app.
 */

import Fastify from "fastify";
import { chromium, type Browser } from "playwright";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 8787);
const SECRET = process.env.PROXY_SHARED_SECRET;
const WIDGET_URL = process.env.ISYWEB_WIDGET_URL ?? "https://isytask-web.vercel.app/api/isyweb-widget";
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

if (!SECRET) {
  console.warn("[proxy-isyweb] WARNING: PROXY_SHARED_SECRET is not set — running unauthenticated");
}

const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 });

// ── Shared browser instance (cold start ~1s) ──
let _browser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return _browser;
}

// ── Auth gate ──
app.addHook("onRequest", async (req, reply) => {
  if (req.url === "/health") return;
  if (!SECRET) return; // dev mode
  const auth = req.headers.authorization ?? "";
  if (auth !== `Bearer ${SECRET}`) {
    return reply.code(401).send({ error: "unauthorized" });
  }
});

// ── Health ──
app.get("/health", async () => ({
  ok: true,
  ts: Date.now(),
  hasBrowser: _browser?.isConnected() ?? false,
}));

// ── Tier 2: Proxy ──

const proxySchema = z.object({
  url: z.string().url(),
  projectKey: z.string().min(1),
  viewport: z.enum(["DESKTOP", "TABLET", "MOBILE"]).default("DESKTOP"),
});

const VIEWPORTS = {
  DESKTOP: { width: 1280, height: 800 },
  TABLET: { width: 768, height: 1024 },
  MOBILE: { width: 390, height: 844 },
};

app.post("/proxy", async (req, reply) => {
  const parse = proxySchema.safeParse(req.body);
  if (!parse.success) return reply.code(400).send({ error: parse.error.format() });
  const { url, projectKey, viewport } = parse.data;

  const u = new URL(url);
  if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
    return reply.code(400).send({ error: "Only http/https URLs are allowed" });
  }

  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: VIEWPORTS[viewport] });
  // Inject widget BEFORE document scripts run
  await context.addInitScript({
    content: `(function(){
      var s = document.createElement('script');
      s.src = '${WIDGET_URL}?project=${encodeURIComponent(projectKey)}';
      s.async = true;
      if (document.head) document.head.appendChild(s);
      else document.addEventListener('DOMContentLoaded', function(){ document.head.appendChild(s); });
    })();`,
  });

  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    let html = await page.content();

    // Rewrite relative URLs to absolute so they resolve against the original origin
    const origin = u.origin;
    html = html
      .replace(/<base[^>]*>/gi, "")
      .replace(/<head([^>]*)>/i, `<head$1><base href="${origin}/">`)
      // Strip meta CSP/X-Frame-Options as well
      .replace(/<meta[^>]+http-equiv=["'](Content-Security-Policy|X-Frame-Options)["'][^>]*>/gi, "");

    reply.header("Content-Type", "text/html; charset=utf-8");
    // We intentionally do NOT forward the original CSP/X-Frame-Options
    reply.header("Cache-Control", "no-store");
    return reply.send(html);
  } catch (e: any) {
    return reply.code(502).send({ error: "fetch_failed", message: String(e?.message ?? e) });
  } finally {
    await context.close();
  }
});

// ── Tier 3: Screenshot ──

const screenshotSchema = z.object({
  url: z.string().url(),
  viewport: z.enum(["DESKTOP", "TABLET", "MOBILE"]).default("DESKTOP"),
  fullPage: z.boolean().default(true),
  format: z.enum(["jpeg", "png"]).default("jpeg"),
  quality: z.number().min(20).max(95).default(70),
});

app.post("/screenshot", async (req, reply) => {
  const parse = screenshotSchema.safeParse(req.body);
  if (!parse.success) return reply.code(400).send({ error: parse.error.format() });
  const { url, viewport, fullPage, format, quality } = parse.data;

  const u = new URL(url);
  if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
    return reply.code(400).send({ error: "Only http/https URLs are allowed" });
  }

  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: VIEWPORTS[viewport] });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    const buffer = await page.screenshot({
      fullPage,
      type: format,
      ...(format === "jpeg" && { quality }),
    });
    reply.header("Content-Type", format === "jpeg" ? "image/jpeg" : "image/png");
    return reply.send(buffer);
  } catch (e: any) {
    return reply.code(502).send({ error: "screenshot_failed", message: String(e?.message ?? e) });
  } finally {
    await context.close();
  }
});

// ── Lifecycle ──

app.addHook("onClose", async () => {
  if (_browser) await _browser.close();
});

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .then((addr) => app.log.info(`[proxy-isyweb] listening on ${addr}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
