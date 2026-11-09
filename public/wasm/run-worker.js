// Отдельный воркер для кода пользователя: основной поток может остановить его в любой момент (бесконечный цикл).
import { runModule } from "./run-core.js";

self.onmessage = async (event) => {
  const { wasm, cases, limit } = event.data;
  try {
    const program = await WebAssembly.compile(wasm);
    for (let i = 0; i < cases.length; i += 1) {
      self.postMessage({ type: "start", index: i });
      self.postMessage({ type: "result", index: i, result: runModule(program, { args: cases[i], limit }) });
    }
    self.postMessage({ type: "done" });
  } catch (e) {
    self.postMessage({ type: "fatal", message: e instanceof Error ? e.message : String(e) });
  }
};
