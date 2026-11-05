import { describe, expect, it } from "vitest";
import { fitSize, inBatches, jpegName, shouldCompress } from "../compress-image";

describe("shouldCompress", () => {
  it("сжимает только большие фото", () => {
    expect(shouldCompress("image/jpeg", 3_000_000)).toBe(true);
    expect(shouldCompress("image/png", 3_000_000)).toBe(true);
    expect(shouldCompress("image/jpeg", 100_000)).toBe(false);
  });

  it("не трогает SVG, GIF и не картинки", () => {
    expect(shouldCompress("image/svg+xml", 3_000_000)).toBe(false);
    expect(shouldCompress("image/gif", 3_000_000)).toBe(false);
    expect(shouldCompress("application/pdf", 3_000_000)).toBe(false);
  });
});

describe("fitSize", () => {
  it("вписывает по длинной стороне и хранит пропорции", () => {
    expect(fitSize(4400, 2200)).toEqual({ width: 2200, height: 1100 });
    expect(fitSize(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it("не увеличивает маленькие", () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("jpegName", () => {
  it("меняет расширение", () => {
    expect(jpegName("IMG_001.HEIC")).toBe("IMG_001.jpg");
    expect(jpegName("тетрадь.стр.2.png")).toBe("тетрадь.стр.2.jpg");
    expect(jpegName("без расширения")).toBe("без расширения.jpg");
  });
});

describe("inBatches", () => {
  it("выполняет всё и не превышает лимит", async () => {
    let active = 0;
    let peak = 0;
    const seen: number[] = [];
    await inBatches([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      seen.push(n);
      active--;
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(peak).toBeLessThanOrEqual(3);
  });
});
