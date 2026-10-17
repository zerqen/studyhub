import { createDecipheriv, createECDH, createHmac, generateKeyPairSync, randomBytes, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encryptPayload, vapidAuthorization } from "../webpush";

const B = (s: string) => Buffer.from(s, "base64url");

describe("web push", () => {
  it("совпадает с тестовым вектором RFC 8291", () => {
    const out = encryptPayload(
      Buffer.from("When I grow up, I want to be a watermelon"),
      "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
      "BTBZMqHH6r4Tts7J_aSIgg",
      { salt: B("DGv6ra1nlYgDCS1FRnbzlw"), senderPrivate: B("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw") },
    );
    expect(out.toString("base64url")).toBe(
      "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
    );
  });

  it("браузер может расшифровать сообщение", () => {
    const ua = createECDH("prime256v1");
    ua.generateKeys();
    const auth = randomBytes(16);
    const enc = encryptPayload(Buffer.from("Привет"), ua.getPublicKey().toString("base64url"), auth.toString("base64url"));
    const salt = enc.subarray(0, 16);
    const keyid = enc.subarray(21, 21 + enc[20]);
    const ct = enc.subarray(21 + enc[20]);
    const h = (k: Buffer, d: Buffer) => createHmac("sha256", k).update(d).digest();
    const hk = (s: Buffer, ikm: Buffer, info: Buffer, n: number) => h(h(s, ikm), Buffer.concat([info, Buffer.from([1])])).subarray(0, n);
    const ikm = hk(auth, ua.computeSecret(keyid), Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), keyid]), 32);
    const d = createDecipheriv("aes-128-gcm", hk(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16), hk(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12));
    d.setAuthTag(ct.subarray(ct.length - 16));
    const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
    expect(plain.subarray(0, -1).toString()).toBe("Привет");
  });

  it("VAPID-подпись проверяется публичным ключом", () => {
    const kp = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const jwk = kp.privateKey.export({ format: "jwk" });
    const pub = Buffer.concat([Buffer.from([4]), B(jwk.x!), B(jwk.y!)]).toString("base64url");
    const header = vapidAuthorization("https://web.push.apple.com/abc", { publicKey: pub, privateKey: jwk.d!, subject: "mailto:a@b.c" });
    const [h, c, s] = header.match(/t=([^,]+)/)![1].split(".");
    expect(verify("sha256", Buffer.from(`${h}.${c}`), { key: kp.publicKey, dsaEncoding: "ieee-p1363" }, B(s))).toBe(true);
    expect(JSON.parse(B(c).toString()).aud).toBe("https://web.push.apple.com");
  });
});
