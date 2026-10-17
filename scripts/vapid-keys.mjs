// Генерирует пару VAPID-ключей для push-уведомлений: node scripts/vapid-keys.mjs
import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64url");

console.log("Добавь в Vercel → Settings → Environment Variables (и в .env для локального запуска):\n");
console.log(`VAPID_PUBLIC_KEY=${pub}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log("VAPID_SUBJECT=mailto:твоя@почта");
console.log(`CRON_SECRET=${Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString("base64url")}`);
