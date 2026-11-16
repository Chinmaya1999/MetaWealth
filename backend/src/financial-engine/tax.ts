import Decimal from "decimal.js";
import { D } from "@mwc/financial-formulas";

/** Indian income-tax estimate. Slabs are planning assumptions (FY 2025-26) and must be confirmed by compliance. */
const NEW: [number, number][] = [[400000, 0], [800000, 0.05], [1200000, 0.1], [1600000, 0.15], [2000000, 0.2], [2400000, 0.25], [Infinity, 0.3]];
const OLD: [number, number][] = [[250000, 0], [500000, 0.05], [1000000, 0.2], [Infinity, 0.3]];

export function slabTax(gross: Decimal.Value, regime: "new" | "old" = "new"): Decimal {
  const std = regime === "new" ? 75000 : 50000;
  const taxable = Decimal.max(0, D(gross).minus(std).minus(regime === "old" ? 150000 : 0));
  const slabs = regime === "new" ? NEW : OLD;
  let prev = 0, tax = D(0);
  for (const [limit, rate] of slabs) { if (taxable.gt(prev)) tax = tax.plus(Decimal.min(taxable, limit).minus(prev).mul(rate)); prev = limit; }
  const rebateLimit = regime === "new" ? 1200000 : 500000;
  if (taxable.lte(rebateLimit)) tax = D(0);
  return tax.mul(1.04); // 4% cess
}
