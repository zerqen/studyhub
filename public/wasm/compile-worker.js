// Clang в отдельном воркере. Файлы компилятора лежат сжатыми и один раз попадают в Cache API.
let tools = null;
let progress = null;
let cacheName = "";

const nativeFetch = self.fetch.bind(self);

async function openCache() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("embedded-compiler-") && k !== cacheName).map((k) => caches.delete(k)));
    return await caches.open(cacheName);
  } catch {
    return null; // приватный режим: просто работаем без кэша
  }
}

async function fetchCompressed(url) {
  const gzUrl = `${url}.gz`;
  const cache = await openCache();
  let response = cache ? await cache.match(gzUrl) : undefined;
  if (!response) {
    response = await nativeFetch(gzUrl);
    if (!response.ok) throw new Error(`Не удалось загрузить компилятор (${response.status})`);
    if (cache) await cache.put(gzUrl, response.clone()).catch(() => undefined);
  }
  const counter = new TransformStream({
    transform(chunk, controller) {
      progress?.(chunk.byteLength);
      controller.enqueue(chunk);
    },
  });
  const body = response.body.pipeThrough(counter).pipeThrough(new DecompressionStream("gzip"));
  const type = url.endsWith(".wasm") ? "application/wasm" : "application/x-tar";
  return new Response(body, { headers: { "content-type": type } });
}

self.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input.url ?? String(input);
  if (/\/wasm\/compiler\/.+\.(wasm|tar)$/.test(new URL(url, self.location.href).pathname)) return fetchCompressed(url);
  return nativeFetch(input, init);
};

async function load(base, version, total) {
  if (tools) return tools;
  if (typeof DecompressionStream === "undefined") throw new Error("Браузер слишком старый: нет DecompressionStream");
  cacheName = `embedded-compiler-${version}`;
  let loaded = 0;
  progress = (n) => {
    loaded += n;
    self.postMessage({ type: "progress", loaded, total });
  };
  const bundle = await import(`${base}bundle.js`);
  tools = bundle.commands;
  return tools;
}

self.onmessage = async (event) => {
  const { id, base, version, total, tool, args, files, output } = event.data;
  let log = "";
  const decoder = new TextDecoder();
  const sink = (bytes) => {
    if (bytes) log += decoder.decode(bytes, { stream: true });
  };
  try {
    const commands = await load(base, version, total);
    const tree = await commands[tool](args, files, { stdout: sink, stderr: sink, fetchProgress: () => undefined });
    const value = tree[output];
    if (value === undefined) throw new Error("Компилятор не создал выходной файл");
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
    const copy = bytes.slice();
    self.postMessage({ type: "compiled", id, ok: true, output: copy, log }, [copy.buffer]);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && "files" in e) {
      self.postMessage({ type: "compiled", id, ok: false, log });
    } else {
      self.postMessage({ type: "failed", id, message: e instanceof Error ? e.message : String(e), log });
    }
  }
};
