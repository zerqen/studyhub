import { describe, expect, it } from "vitest";
import { CHUNK_SECONDS, chunkBounds, wavChunk } from "../audio-chunks";

describe("нарезка записи", () => {
  const rate = 16000;
  const samples = new Float32Array(rate * 600); // 10 минут
  for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i / 7) * 0.5;
  // «Паузы» каждые 61 секунду
  for (let s = 61; s < 600; s += 61) samples.fill(0, s * rate, s * rate + rate / 2);

  it("куски покрывают запись без дыр и меньше лимита Vercel", () => {
    const b = chunkBounds(samples, rate);
    expect(b[0][0]).toBe(0);
    expect(b[b.length - 1][1]).toBe(samples.length);
    for (let i = 1; i < b.length; i++) expect(b[i][0]).toBe(b[i - 1][1]);
    for (const [from, to] of b) expect(44 + (to - from) * 2).toBeLessThan(4.4 * 1024 * 1024);
    expect(b.length).toBe(Math.ceil(600 / CHUNK_SECONDS));
  });

  it("режет в тишине, а не посреди звука", () => {
    const [[, end]] = chunkBounds(samples, rate);
    // ближайшая пауза перед 125 с — на 122 с
    expect(Math.abs(end / rate - 122.25)).toBeLessThan(0.3);
  });

  it("правильный заголовок WAV", async () => {
    const blob = wavChunk(samples, rate, 0, rate);
    const v = new DataView(await blob.arrayBuffer());
    expect(blob.size).toBe(44 + rate * 2);
    expect(v.getUint32(24, true)).toBe(rate);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(40, true)).toBe(rate * 2);
  });
});
