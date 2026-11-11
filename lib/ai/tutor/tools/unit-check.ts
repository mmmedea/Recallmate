import { z } from "zod";
import { UnitCheckSchema } from "./schemas";
import * as math from "mathjs";

type UnitCheckArgs = z.infer<typeof UnitCheckSchema>;

export type UnitCheckResult = {
  valid: boolean;
  value?: number;
  unit?: string;
  reason?: string;
};

export function executeUnitCheck(args: UnitCheckArgs): UnitCheckResult {
  try {
    // mathjs handles unit conversion securely and checks dimensional compatibility
    const fromUnit = math.unit(args.value, args.fromUnit);
    const result = fromUnit.toNumber(args.toUnit);

    return {
      valid: true,
      value: result,
      unit: args.toUnit
    };
  } catch (err: any) {
    return {
      valid: false,
      reason: `Unit conversion failed: ${err.message}. Ensure dimensions are compatible (e.g., you cannot convert kg to meters).`
    };
  }
}
