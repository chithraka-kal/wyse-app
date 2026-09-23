import crypto from "crypto";
import { promisify } from "util";

const pbkdf2Async = promisify(crypto.pbkdf2);

const iterations = 120000;
const keyLength = 64;
const digest = "sha512";

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await pbkdf2Async(password, salt, iterations, keyLength, digest);
  const hash = derivedKey.toString("hex");

  return { salt, hash };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const derivedKey = await pbkdf2Async(password, salt, iterations, keyLength, digest);
  const actualHash = derivedKey.toString("hex");

  return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}
