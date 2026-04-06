import sharp from "sharp";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");

const ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0" stop-color="#3888c8"/>
      <stop offset="1" stop-color="#11aa7e"/>
    </linearGradient>
  </defs>
  <rect width="280" height="280" rx="56" fill="#1a1a2e"/>
  <g transform="translate(140,140) scale(1.08) translate(-120,-141)">
    <rect x="9" y="36.55" width="64.33" height="64.33" rx="32.17" fill="url(#g1)"/>
    <rect x="166.78" y="36.55" width="64.33" height="64.33" rx="32.17" fill="url(#g1)"/>
    <rect x="166.78" y="182.12" width="64.33" height="64.33" rx="32.17" fill="url(#g1)"/>
    <rect x="9" y="109.33" width="64.33" height="137.12" rx="32.17" fill="url(#g1)"/>
    <rect x="87.89" y="36.55" width="64.33" height="209.9" rx="32.17" fill="url(#g1)"/>
  </g>
</svg>`;

async function main() {
  const webApp = join(ROOT, "apps/web/app");

  // favicon.ico (32x32)
  await sharp(Buffer.from(ICON_SVG))
    .resize(32, 32)
    .png()
    .toFile(join(webApp, "favicon.ico"));
  console.log("✅ favicon.ico (32x32)");

  // icon.png (used by Next.js as apple-touch-icon)
  await sharp(Buffer.from(ICON_SVG))
    .resize(180, 180)
    .png()
    .toFile(join(webApp, "icon.png"));
  console.log("✅ icon.png (180x180)");

  // apple-icon.png
  await sharp(Buffer.from(ICON_SVG))
    .resize(180, 180)
    .png()
    .toFile(join(webApp, "apple-icon.png"));
  console.log("✅ apple-icon.png (180x180)");

  // og image placeholder (for public/)
  await sharp(Buffer.from(ICON_SVG))
    .resize(512, 512)
    .png()
    .toFile(join(ROOT, "apps/web/public/isytask-icon-512.png"));
  console.log("✅ isytask-icon-512.png (512x512)");

  console.log("\n🎉 Web favicons generated!");
}

main().catch(console.error);
