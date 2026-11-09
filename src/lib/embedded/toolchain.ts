import { COMPILE_TIMEOUT_MS, COMPILER_BASE, COMPILER_VERSION, OUTPUT_LIMIT } from "./driver";
import type { CompileRequest, RunResult } from "./types";

export type Compiled = { ok: true; output: Uint8Array; log: string } | { ok: false; log: string };
export type CaseResult = { timedOut: true } | { timedOut: false; result: RunResult };
export type LoadProgress = { loaded: number; total: number };

/** Компилятор и запуск в отдельных воркерах. Основной поток только ждёт и может их остановить. */
export class Toolchain {
  private compiler: Worker | null = null;
  private seq = 0;
  private total = 0;

  private async manifestTotal() {
    if (this.total) return this.total;
    const res = await fetch(`${COMPILER_BASE}manifest.json`);
    if (!res.ok) throw new Error("Файлы компилятора не найдены");
    this.total = (await res.json()).total as number;
    return this.total;
  }

  async compile(request: CompileRequest, onProgress?: (p: LoadProgress) => void): Promise<Compiled> {
    const total = await this.manifestTotal();
    this.compiler ??= new Worker("/wasm/compile-worker.js", { type: "module" });
    const worker = this.compiler;
    const id = ++this.seq;
    return new Promise<Compiled>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const stop = () => {
        clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
      };
      const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          stop();
          this.resetCompiler();
          reject(new Error("Компилятор не ответил вовремя"));
        }, COMPILE_TIMEOUT_MS);
      };
      const onMessage = (event: MessageEvent) => {
        const data = event.data;
        if (data.type === "progress") {
          arm();
          onProgress?.({ loaded: data.loaded, total: data.total });
          return;
        }
        if (data.id !== id) return;
        stop();
        if (data.type === "failed") {
          this.resetCompiler();
          reject(new Error(data.message));
        } else if (data.ok) resolve({ ok: true, output: data.output, log: data.log });
        else resolve({ ok: false, log: data.log });
      };
      const onError = (event: ErrorEvent) => {
        stop();
        this.resetCompiler();
        reject(new Error(event.message || "Сбой компилятора"));
      };
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      arm();
      worker.postMessage({ id, base: COMPILER_BASE, version: COMPILER_VERSION, total, ...request });
    });
  }

  /** Выполняет случаи по очереди. Зависший случай останавливается, остальные идут в новом воркере. */
  async run(wasm: Uint8Array, cases: string[][], timeoutMs: number): Promise<CaseResult[]> {
    const results: CaseResult[] = [];
    while (results.length < cases.length) {
      await this.runBatch(wasm, cases.slice(results.length), timeoutMs, results);
    }
    return results;
  }

  private runBatch(wasm: Uint8Array, cases: string[][], timeoutMs: number, results: CaseResult[]) {
    return new Promise<void>((resolve, reject) => {
      const worker = new Worker("/wasm/run-worker.js", { type: "module" });
      let timer: ReturnType<typeof setTimeout>;
      const finish = () => {
        clearTimeout(timer);
        worker.terminate();
      };
      const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          finish();
          results.push({ timedOut: true });
          resolve();
        }, timeoutMs);
      };
      worker.onmessage = (event) => {
        const data = event.data;
        if (data.type === "start") arm();
        else if (data.type === "result") {
          clearTimeout(timer);
          results.push({ timedOut: false, result: data.result });
        } else if (data.type === "done") {
          finish();
          resolve();
        } else if (data.type === "fatal") {
          finish();
          reject(new Error(data.message));
        }
      };
      worker.onerror = (event) => {
        finish();
        reject(new Error(event.message || "Сбой при запуске программы"));
      };
      arm();
      worker.postMessage({ wasm, cases, limit: OUTPUT_LIMIT });
    });
  }

  private resetCompiler() {
    this.compiler?.terminate();
    this.compiler = null;
  }

  dispose() {
    this.resetCompiler();
  }
}
