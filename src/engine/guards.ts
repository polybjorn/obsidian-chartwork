export type Obj = Record<string, unknown>;

/** Any non-array object, as YAML and scripts hand over. */
export function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Merging into a Date or a class instance would copy its fields onto a plain
// object, so only literals count
export function isPlain(v: unknown): v is Obj {
  return isObj(v) && Object.getPrototypeOf(v) === Object.prototype;
}

export function isOneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return (list as readonly unknown[]).includes(v);
}
