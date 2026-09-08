import "server-only";

import bcrypt from "bcryptjs";

// bcryptjs is pure JavaScript, so it needs no native build step under Next.js
// or in the AWS Amplify Lambda bundle. argon2 would require node-gyp there.
const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
