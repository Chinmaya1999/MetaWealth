import { AssumptionSet } from "../database/models";
import { DEFAULT_ASSUMPTIONS, type Assumptions } from "../financial-engine/assumptions";
export async function activeAssumptions(): Promise<{ version: number; values: Assumptions }> {
  let a = await AssumptionSet.findOne({ active: true }).sort({ version: -1 });
  if (!a) a = await AssumptionSet.create({ version: 1, active: true, values: DEFAULT_ASSUMPTIONS, reason: "Initial BRD defaults" });
  return { version: a.version, values: { ...DEFAULT_ASSUMPTIONS, ...(a.values as any) } };
}
