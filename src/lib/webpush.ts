import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto";

/**
 * Web Push без сторонних библиотек: шифрование aes128gcm (RFC 8291 / RFC 8188) и подпись VAPID (RFC 8292).
 * Ключи VAPID: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…). Сгенерировать: node scripts/vapid-keys.mjs
 */

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

const b64url = (buf: Buffer) => buf.toString("base64url");
const fromB64url = (s: string) => Buffer.from(s.replace(/=+$/, ""), "base64url");

function hmac(key: Buffer, data: Buffer) {
  return createHmac("sha256", key).update(data).digest();
}

/** HKDF с одним блоком вывода (нам нужно не больше 32 байт) */
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number) {
  const prk = hmac(salt, ikm);
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);
}

/** Шифрует сообщение для конкретной подписки. salt и ключ отправителя можно передать для проверки по тестовым векторам. */
export function encryptPayload(
  payload: Buffer,
  uaPublicB64: string,
  authSecretB64: string,
  opts: { salt?: Buffer; senderPrivate?: Buffer } = {},
) {
  const uaPublic = fromB64url(uaPublicB64);
  const authSecret = fromB64url(authSecretB64);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error("Неверный ключ подписки");

  const ecdh = createECDH("prime256v1");
  if (opts.senderPrivate) ecdh.setPrivateKey(opts.senderPrivate);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hkdf(authSecret, shared, keyInfo, 32);
  const salt = opts.salt ?? randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);

  // Одна запись: данные + разделитель 0x02 (последняя запись), без дополнительного выравнивания
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

export function vapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:studyhub@example.com";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

/** Заголовок Authorization по VAPID: JWT ES256 для origin push-сервиса */
export function vapidAuthorization(endpoint: string, keys: { publicKey: string; privateKey: string; subject: string }, now = Date.now()) {
  const pub = fromB64url(keys.publicKey);
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: keys.privateKey.replace(/=+$/, ""), x: b64url(pub.subarray(1, 33)), y: b64url(pub.subarray(33, 65)) },
    format: "jwk",
  });
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url(
    Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject })),
  );
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${keys.publicKey.replace(/=+$/, "")}`;
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/** Отправляет push. gone=true — подписка больше не действует, её надо удалить. */
export async function sendPush(target: PushTarget, message: PushMessage, ttl = 12 * 3600): Promise<{ ok: boolean; gone: boolean; status: number }> {
  const keys = vapidKeys();
  if (!keys) throw new Error("Push не настроен: нет VAPID-ключей");
  const body = encryptPayload(Buffer.from(JSON.stringify(message)), target.p256dh, target.auth);
  const res = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuthorization(target.endpoint, keys),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttl),
      Urgency: "normal",
      ...(message.tag ? { Topic: message.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "studyhub" } : {}),
    },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(10_000),
  });
  return { ok: res.ok, gone: res.status === 404 || res.status === 410, status: res.status };
}
