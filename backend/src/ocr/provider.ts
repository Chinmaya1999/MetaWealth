export interface Extracted { field: string; value: string; confidence: number; page: number }
export interface OCRProvider { name: string; extract(category: string, file: Buffer, mime: string): Promise<{ ok: boolean; fields: Extracted[] }> }

const first = (t: string, re: RegExp) => t.match(re)?.[1]?.trim();
const num = (s?: string) => (s ? s.replace(/[^\d.]/g, "") : undefined);

/** Dev provider: parses text-based files only. Images/PDFs return ok=false so a human enters values. TextractProvider plugs in here. */
export const MockOCRProvider: OCRProvider = {
  name: "mock",
  async extract(category, file, mime) {
    if (!/^text\//.test(mime) && !/\.(txt|csv)$/i.test(mime)) return { ok: false, fields: [] };
    const t = file.toString("utf8"); const f: Extracted[] = [];
    const add = (field: string, v: string | undefined, c = 0.7) => v && f.push({ field, value: v, confidence: c, page: 1 });
    if (category === "pan") { add("pan", first(t, /\b([A-Z]{5}[0-9]{4}[A-Z])\b/), 0.9); add("name", first(t, /Name[:\s]+([A-Za-z .]+)/i)); add("dob", first(t, /(\d{2}\/\d{2}\/\d{4})/)); }
    if (category === "payslip") { add("takeHome", num(first(t, /Net\s*(?:Pay|Salary)[^\d]*([\d,]+)/i))); add("pfMonthly", num(first(t, /Provident Fund[^\d]*([\d,]+)/i))); add("employer", first(t, /Employer[:\s]+([^\n]+)/i)); }
    if (category === "loan") { add("outstanding", num(first(t, /Outstanding[^\d]*([\d,]+)/i))); add("emi", num(first(t, /EMI[^\d]*([\d,]+)/i))); add("rate", first(t, /Rate[^\d]*([\d.]+)\s*%/i)); add("months", first(t, /(\d+)\s*months/i)); }
    if (category === "bank") { add("balance", num(first(t, /Closing Balance[^\d]*([\d,]+)/i))); add("bank", first(t, /^([A-Za-z ]+Bank)/im)); }
    if (category === "insurance") { add("sumAssured", num(first(t, /Sum Assured[^\d]*([\d,]+)/i))); add("premium", num(first(t, /Premium[^\d]*([\d,]+)/i))); }
    return { ok: f.length > 0, fields: f };
  },
};
