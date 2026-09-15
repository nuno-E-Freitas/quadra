/**
 * Drizzle wraps driver errors in DrizzleQueryError, so the Postgres `code` sits
 * on `.cause` (sometimes deeper). Walk the chain rather than trusting the top.
 */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current === "object" && "code" in current && (current as { code?: string }).code === "23505") {
      if (!constraint) return true;
      const name = (current as { constraint_name?: string }).constraint_name;
      return name === constraint;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
