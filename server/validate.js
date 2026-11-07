// Small input coercion helpers. Everything arriving over the wire goes through one of these.

/** Trimmed string capped at `max` chars; non-strings become "". */
export const str = (value, max = 80) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Integer clamped to [lo, hi]; non-numbers become `fallback`. */
export const int = (value, lo, hi, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : fallback;
};

/** Throws a user-facing error unless `condition` is truthy. */
export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
