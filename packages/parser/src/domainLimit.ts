const numericLimit = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const piLimit = /^([+-]?)\s*(?:(\d+(?:\.\d*)?|\.\d+)\s*\*?\s*)?(?:pi|π)(?:\s*\/\s*(\d+(?:\.\d*)?|\.\d+))?$/i;

/** Parse a numeric literal or a signed multiple of pi without evaluating source. */
export function parseDomainLimit(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value.length > 64) return undefined;
  const text = value.trim();
  if (numericLimit.test(text)) {
    const number = Number(text);
    return Number.isFinite(number) ? number : undefined;
  }
  const parts = piLimit.exec(text);
  if (!parts) return undefined;
  const [, sign, factor = "1", divisor = "1"] = parts;
  const number = (sign === "-" ? -1 : 1) * Number(factor) * Math.PI / Number(divisor);
  return Number.isFinite(number) ? number : undefined;
}

export function normalizeDomainLimits(value: unknown): unknown {
  return Array.isArray(value) && value.length === 2
    ? value.map(limit => parseDomainLimit(limit) ?? limit)
    : value;
}
