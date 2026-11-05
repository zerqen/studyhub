/** Сжатие фото в браузере перед загрузкой: снимок тетради с телефона весит 3–8 МБ, а для чтения хватает нескольких сотен КБ. */

/** Длинная сторона: при таком размере рукописный текст читается и человеком, и моделью распознавания */
export const MAX_IMAGE_SIDE = 2200;
const QUALITY = 0.82;
/** Меньше этого сжимать незачем */
const MIN_SIZE = 500 * 1024;

const COMPRESSIBLE = /^image\/(jpeg|png|webp|heic|heif)$/i;

export function shouldCompress(type: string, size: number) {
  return COMPRESSIBLE.test(type) && size > MIN_SIZE;
}

/** Размер после вписывания в квадрат side × side: пропорции те же, увеличения нет */
export function fitSize(width: number, height: number, side = MAX_IMAGE_SIDE) {
  const scale = Math.min(1, side / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Новое имя файла с расширением .jpg */
export function jpegName(name: string) {
  return `${name.replace(/\.[^./\\]+$/, "") || "photo"}.jpg`;
}

/** Если сжать не удалось или выигрыша нет, возвращается исходный файл: загрузка не должна ломаться */
export async function compressImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || !shouldCompress(file.type, file.size)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = fitSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // В JPEG нет прозрачности: у PNG прозрачные места станут белыми, а не чёрными
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size * 0.9) return file;
    return new File([blob], jpegName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** Запускает задачи не больше limit одновременно: десяток фото не должен забивать телефонный интернет */
export async function inBatches<T>(items: T[], limit: number, run: (item: T) => Promise<unknown>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await run(items[next++]);
    }),
  );
}
