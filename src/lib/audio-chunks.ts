/**
 * Нарезка длинной записи в браузере: декодируем, сводим в моно 16 кГц и режем на WAV-куски,
 * каждый меньше лимита Vercel на тело запроса (4,5 МБ). Whisper всё равно работает на 16 кГц —
 * качество распознавания не страдает.
 */

/** Секунд в одном куске: 16 000 × 2 байта × 125 с ≈ 4 МБ */
export const CHUNK_SECONDS = 125;

export async function decodeMono(data: ArrayBuffer): Promise<{ samples: Float32Array; rate: number }> {
  const Ctx: typeof OfflineAudioContext =
    window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  let audio: AudioBuffer | null = null;
  let rate = 16000;
  // Старые Safari не умеют контекст на 16 кГц — тогда 22,05 кГц
  for (const r of [16000, 22050]) {
    try {
      const ctx = new Ctx(1, 1, r);
      audio = await ctx.decodeAudioData(data.slice(0));
      rate = r;
      break;
    } catch (e) {
      if (r === 22050) throw e;
    }
  }
  if (!audio) throw new Error("Не удалось прочитать запись");
  if (audio.numberOfChannels === 1) return { samples: audio.getChannelData(0), rate: audio.sampleRate };
  const out = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < ch.length; i++) out[i] += ch[i] / audio.numberOfChannels;
  }
  return { samples: out, rate: audio.sampleRate || rate };
}

/** 16-битный PCM WAV из куска сэмплов */
export function wavChunk(samples: Float32Array, rate: number, from: number, to: number) {
  const n = Math.max(0, Math.min(samples.length, to) - from);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // моно
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[from + i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

/**
 * Границы кусков: режем не ровно по 125 с, а в самом тихом месте последних секунд куска —
 * так реже рвётся слово на стыке.
 */
export function chunkBounds(samples: Float32Array, rate: number, seconds = CHUNK_SECONDS) {
  const size = Math.floor(seconds * rate);
  const look = Math.floor(4 * rate);
  const win = Math.floor(0.05 * rate);
  const bounds: [number, number][] = [];
  let start = 0;
  while (start < samples.length) {
    let end = Math.min(samples.length, start + size);
    if (end < samples.length) {
      let best = end;
      let bestEnergy = Infinity;
      for (let p = end - look; p + win <= end; p += win) {
        let e = 0;
        for (let i = p; i < p + win; i++) e += samples[i] * samples[i];
        if (e < bestEnergy) {
          bestEnergy = e;
          best = p + Math.floor(win / 2);
        }
      }
      end = best;
    }
    bounds.push([start, end]);
    start = end;
  }
  return bounds;
}
