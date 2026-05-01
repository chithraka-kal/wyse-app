import crypto from "crypto";

const iterations = 120000;
const keyLength = 64;
const digest = "sha512";

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, keyLength, digest)
    .toString("hex");

  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actualHash = crypto
    .pbkdf2Sync(password, salt, iterations, keyLength, digest)
    .toString("hex");

  return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}
