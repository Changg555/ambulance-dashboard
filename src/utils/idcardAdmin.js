import nacl from "tweetnacl";
import { decodeBase64, decodeUTF8 } from "tweetnacl-util";

/**
 * Salsa20/8 Core (RFC 7914 Section 3)
 */
function salsa20_8(B) {
  const x = new Int32Array(16);
  for (let i = 0; i < 16; i++) x[i] = B[i];

  for (let i = 8; i > 0; i -= 2) {
    let u;
    u = (x[0] + x[12]) | 0; x[4] ^= (u << 7) | (u >>> 25);
    u = (x[4] + x[0]) | 0;  x[8] ^= (u << 9) | (u >>> 23);
    u = (x[8] + x[4]) | 0;  x[12] ^= (u << 13) | (u >>> 19);
    u = (x[12] + x[8]) | 0; x[0] ^= (u << 18) | (u >>> 14);

    u = (x[5] + x[1]) | 0;  x[9] ^= (u << 7) | (u >>> 25);
    u = (x[9] + x[5]) | 0;  x[13] ^= (u << 9) | (u >>> 23);
    u = (x[13] + x[9]) | 0; x[1] ^= (u << 13) | (u >>> 19);
    u = (x[1] + x[13]) | 0; x[5] ^= (u << 18) | (u >>> 14);

    u = (x[10] + x[6]) | 0; x[14] ^= (u << 7) | (u >>> 25);
    u = (x[14] + x[10]) | 0; x[2] ^= (u << 9) | (u >>> 23);
    u = (x[2] + x[14]) | 0; x[6] ^= (u << 13) | (u >>> 19);
    u = (x[6] + x[2]) | 0;  x[10] ^= (u << 18) | (u >>> 14);

    u = (x[15] + x[11]) | 0; x[3] ^= (u << 7) | (u >>> 25);
    u = (x[3] + x[15]) | 0; x[7] ^= (u << 9) | (u >>> 23);
    u = (x[7] + x[3]) | 0;  x[11] ^= (u << 13) | (u >>> 19);
    u = (x[11] + x[7]) | 0; x[15] ^= (u << 18) | (u >>> 14);

    u = (x[0] + x[3]) | 0;  x[1] ^= (u << 7) | (u >>> 25);
    u = (x[1] + x[0]) | 0;  x[2] ^= (u << 9) | (u >>> 23);
    u = (x[2] + x[1]) | 0;  x[3] ^= (u << 13) | (u >>> 19);
    u = (x[3] + x[2]) | 0;  x[0] ^= (u << 18) | (u >>> 14);

    u = (x[5] + x[4]) | 0;  x[6] ^= (u << 7) | (u >>> 25);
    u = (x[6] + x[5]) | 0;  x[7] ^= (u << 9) | (u >>> 23);
    u = (x[7] + x[6]) | 0;  x[4] ^= (u << 13) | (u >>> 19);
    u = (x[4] + x[7]) | 0;  x[5] ^= (u << 18) | (u >>> 14);

    u = (x[10] + x[9]) | 0; x[11] ^= (u << 7) | (u >>> 25);
    u = (x[11] + x[10]) | 0; x[8] ^= (u << 9) | (u >>> 23);
    u = (x[8] + x[11]) | 0; x[9] ^= (u << 13) | (u >>> 19);
    u = (x[9] + x[8]) | 0;  x[10] ^= (u << 18) | (u >>> 14);

    u = (x[15] + x[14]) | 0; x[12] ^= (u << 7) | (u >>> 25);
    u = (x[12] + x[15]) | 0; x[13] ^= (u << 9) | (u >>> 23);
    u = (x[13] + x[12]) | 0; x[14] ^= (u << 13) | (u >>> 19);
    u = (x[14] + x[13]) | 0; x[15] ^= (u << 18) | (u >>> 14);
  }

  for (let i = 0; i < 16; i++) B[i] = (B[i] + x[i]) | 0;
}

function blockMixSalsa8(BY, Yi, r) {
  const X = new Int32Array(16);
  const start = (2 * r - 1) * 16;
  for (let i = 0; i < 16; i++) X[i] = BY[start + i];

  for (let i = 0; i < 2 * r; i++) {
    const offset = i * 16;
    for (let j = 0; j < 16; j++) X[j] ^= BY[offset + j];
    salsa20_8(X);
    const dest = Yi + (i >> 1) * 16 + (i & 1 ? r * 16 : 0);
    for (let j = 0; j < 16; j++) BY[dest + j] = X[j];
  }
}

async function pbkdf2Sha256(passwordBytes, saltBytes, dkLen) {
  const cryptoObj = window.crypto;
  const baseKey = await cryptoObj.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await cryptoObj.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 1,
      hash: "SHA-256",
    },
    baseKey,
    dkLen * 8
  );
  return new Uint8Array(bits);
}

/**
 * ฟังก์ชัน scrypt (RFC 7914) ที่ทำงานบนเบราว์เซอร์ 100% ตรงกับ Node crypto.scryptSync และ scrypt-js
 */
export async function scryptDerive(passwordBytes, saltBytes, N, r, p, dkLen) {
  const B = await pbkdf2Sha256(passwordBytes, saltBytes, p * 128 * r);
  const XY = new Int32Array(64 * r);
  const V = new Int32Array(32 * r * N);
  const Yi = 32 * r;

  for (let i = 0; i < p; i++) {
    const bOffset = i * 128 * r;
    for (let k = 0; k < 32 * r; k++) {
      const idx = bOffset + k * 4;
      XY[k] =
        (B[idx] & 0xff) |
        ((B[idx + 1] & 0xff) << 8) |
        ((B[idx + 2] & 0xff) << 16) |
        ((B[idx + 3] & 0xff) << 24);
    }

    for (let j = 0; j < N; j++) {
      const vOffset = j * (32 * r);
      for (let k = 0; k < 32 * r; k++) V[vOffset + k] = XY[k];
      blockMixSalsa8(XY, Yi, r);
      for (let k = 0; k < 32 * r; k++) XY[k] = XY[Yi + k];
    }

    for (let j = 0; j < N; j++) {
      const integerify = XY[(2 * r - 1) * 16] & (N - 1);
      const vOffset = integerify * (32 * r);
      for (let k = 0; k < 32 * r; k++) XY[k] ^= V[vOffset + k];
      blockMixSalsa8(XY, Yi, r);
      for (let k = 0; k < 32 * r; k++) XY[k] = XY[Yi + k];
    }

    for (let k = 0; k < 32 * r; k++) {
      const idx = bOffset + k * 4;
      const val = XY[k];
      B[idx] = val & 0xff;
      B[idx + 1] = (val >>> 8) & 0xff;
      B[idx + 2] = (val >>> 16) & 0xff;
      B[idx + 3] = (val >>> 24) & 0xff;
    }
  }

  return pbkdf2Sha256(passwordBytes, B, dkLen);
}

/**
 * ปลดล็อก Private Key ของแอดมินจากไฟล์ idcard-key.enc.json ด้วยรหัสผ่าน
 * (ทำงานในหน่วยความจำของเบราว์เซอร์เท่านั้น ไม่บันทึกลง Storage)
 */
export async function unlockKey(fileText, password) {
  let parsed;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new Error("รูปแบบไฟล์คีย์ไม่ถูกต้อง (ต้องเป็นไฟล์ .json)");
  }

  const { salt, nonce, box } = parsed;
  if (!salt || !nonce || !box) {
    throw new Error("ไฟล์คีย์ไม่สมบูรณ์ (ไม่พบ salt, nonce หรือ box)");
  }

  const dk = await scryptDerive(
    decodeUTF8(password),
    decodeBase64(salt),
    2 ** 15,
    8,
    1,
    32
  );

  const sk = nacl.secretbox.open(
    decodeBase64(box),
    decodeBase64(nonce),
    dk
  );

  if (!sk) {
    throw new Error("รหัสผ่านไม่ถูกต้อง หรือไฟล์ key เสียหาย");
  }

  return sk; // Uint8Array (32 bytes secretKey)
}

/**
 * ถอดรหัสเลขบัตรประชาชน 13 หลักจากค่า idcardSealed ในคอลเลกชัน users_private/{uid}
 */
export function decryptIdCard(sealed, secretKey) {
  if (!sealed || !sealed.ct || !sealed.nonce || !sealed.epk) {
    throw new Error("ไม่พบข้อมูลเลขบัตรที่เข้ารหัสไว้ของผู้ใช้นี้");
  }

  const out = nacl.box.open(
    decodeBase64(sealed.ct),
    decodeBase64(sealed.nonce),
    decodeBase64(sealed.epk),
    secretKey
  );

  if (!out) {
    throw new Error("ถอดรหัสไม่สำเร็จ (คีย์ไม่ตรงกับข้อมูลที่เข้ารหัส)");
  }

  return new TextDecoder().decode(out);
}

/**
 * จัดรูปแบบเลขบัตรประชาชน 13 หลักให้อ่านง่าย (x-xxxx-xxxxx-xx-x)
 */
export function formatIdCardNumber(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length !== 13) return raw;
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`;
}
