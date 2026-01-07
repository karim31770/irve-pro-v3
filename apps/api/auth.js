import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const JWT_SECRET = mustEnv("JWT_SECRET");
const key = new TextEncoder().encode(JWT_SECRET);

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function signToken({ userId }) {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, key);
  const uid = payload.uid;
  if (typeof uid !== "string") throw new Error("Invalid token payload");
  return { userId: uid };
}
