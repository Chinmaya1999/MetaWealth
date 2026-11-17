import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { HttpError } from "../../utils/errors";

function findChrome(): string | null {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const root = path.resolve(process.cwd(), ".chrome");
  const walk = (d: string): string | null => { if (!fs.existsSync(d)) return null; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { const f = walk(p); if (f) return f; } else if (/^(chrome-headless-shell|Google Chrome for Testing|chrome)$/.test(e.name)) return p; } return null; };
  return walk(root);
}

export async function htmlToPdf(html: string, clientName: string, brandName = "MetaWealth Capital"): Promise<Buffer> {
  const exe = findChrome(); if (!exe) throw new HttpError(503, "PDF engine not installed on this server", "PDF_UNAVAILABLE");
  const browser = await puppeteer.launch({ executablePath: exe, args: ["--no-sandbox"], headless: true });
  try {
    const page = await browser.newPage(); await page.setContent(html, { waitUntil: "load" });
    const safe = clientName.replace(/[<>&"]/g, "");
    return Buffer.from(await page.pdf({ format: "A4", printBackground: true, displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:8px;width:100%;padding:0 12mm;color:#728096;display:flex;justify-content:space-between"><span>${brandName}</span><span style="color:#55B848;letter-spacing:2px">CONFIDENTIAL</span><span>${safe}</span></div>`,
      footerTemplate: `<div style="font-size:8px;width:100%;padding:0 12mm;color:#728096;text-align:center">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
      margin: { top: "18mm", bottom: "16mm", left: "12mm", right: "12mm" } }));
  } finally { await browser.close(); }
}
