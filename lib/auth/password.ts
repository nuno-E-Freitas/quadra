import bcrypt from "bcryptjs";

/** bcrypt silently ignores bytes past 72, so the form caps length there too. */
export const MAX_PASSWORD_BYTES = 72;
const COST = 12;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
