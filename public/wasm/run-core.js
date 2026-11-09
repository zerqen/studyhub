// Запуск скомпилированной C/C++ программы. Общий код для браузерного воркера и проверки заданий в Node.
// Программа видит только импорты ниже: ни сети, ни DOM, ни данных сайта у неё нет.

const ERR_BADF = 8;
const ERR_NOSYS = 52;
const ERR_SPIPE = 70;

class Exit {
  constructor(code) {
    this.code = code;
  }
}
class OutputLimit {}

export function runModule(program, { args = [], limit = 64 * 1024 } = {}) {
  let memory = null;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const state = { stdout: "", stderr: "", bytes: 0, truncated: false, reports: [] };
  const argv = ["program", ...args].map((a) => encoder.encode(`${a}\0`));

  const view = () => new DataView(memory.buffer);
  const cstr = (ptr) => {
    if (!ptr) return "";
    const bytes = new Uint8Array(memory.buffer);
    let end = ptr;
    while (end < bytes.length && bytes[end] !== 0) end += 1;
    return decoder.decode(bytes.subarray(ptr, end));
  };

  const wasi = {
    args_sizes_get(countPtr, sizePtr) {
      view().setUint32(countPtr, argv.length, true);
      view().setUint32(sizePtr, argv.reduce((n, a) => n + a.length, 0), true);
      return 0;
    },
    args_get(argvPtr, bufPtr) {
      const v = view();
      const mem = new Uint8Array(memory.buffer);
      let at = bufPtr;
      argv.forEach((a, i) => {
        v.setUint32(argvPtr + i * 4, at, true);
        mem.set(a, at);
        at += a.length;
      });
      return 0;
    },
    environ_sizes_get(countPtr, sizePtr) {
      view().setUint32(countPtr, 0, true);
      view().setUint32(sizePtr, 0, true);
      return 0;
    },
    environ_get: () => 0,
    clock_time_get(_id, _precision, timePtr) {
      view().setBigUint64(timePtr, BigInt(Date.now()) * 1000000n, true);
      return 0;
    },
    random_get(ptr, len) {
      const mem = new Uint8Array(memory.buffer, ptr, len);
      for (let i = 0; i < len; i += 1) mem[i] = Math.floor(Math.random() * 256);
      return 0;
    },
    fd_write(fd, iovs, count, writtenPtr) {
      if (fd !== 1 && fd !== 2) return ERR_BADF;
      const v = view();
      let total = 0;
      let text = "";
      for (let i = 0; i < count; i += 1) {
        const ptr = v.getUint32(iovs + i * 8, true);
        const len = v.getUint32(iovs + i * 8 + 4, true);
        total += len;
        text += decoder.decode(new Uint8Array(memory.buffer, ptr, len), { stream: true });
      }
      if (fd === 1) state.stdout += text;
      else state.stderr += text;
      state.bytes += total;
      v.setUint32(writtenPtr, total, true);
      if (state.bytes > limit) {
        state.truncated = true;
        throw new OutputLimit();
      }
      return 0;
    },
    fd_read(_fd, _iovs, _count, readPtr) {
      view().setUint32(readPtr, 0, true);
      return 0;
    },
    fd_close: () => 0,
    fd_seek: () => ERR_SPIPE,
    fd_fdstat_get(fd, ptr) {
      if (fd > 2) return ERR_BADF;
      const v = view();
      v.setUint8(ptr, 2);
      v.setUint8(ptr + 1, 0);
      v.setUint16(ptr + 2, 0, true);
      v.setBigUint64(ptr + 8, 0n, true);
      v.setBigUint64(ptr + 16, 0n, true);
      return 0;
    },
    fd_prestat_get: () => ERR_BADF,
    fd_prestat_dir_name: () => ERR_BADF,
    proc_exit(code) {
      throw new Exit(code);
    },
  };

  const studyhub = {
    report(ok, exprPtr, gotPtr, expectedPtr) {
      state.reports.push({ ok: Boolean(ok), expr: cstr(exprPtr), got: cstr(gotPtr), expected: cstr(expectedPtr) });
    },
  };

  const imports = {};
  for (const item of WebAssembly.Module.imports(program)) {
    if (item.kind !== "function") continue;
    imports[item.module] ??= {};
    const known = item.module === "studyhub" ? studyhub[item.name] : wasi[item.name];
    imports[item.module][item.name] = known ?? (() => ERR_NOSYS);
  }

  let exit = 0;
  let trap = null;
  try {
    const instance = new WebAssembly.Instance(program, imports);
    memory = instance.exports.memory;
    instance.exports._start();
  } catch (e) {
    if (e instanceof Exit) exit = e.code;
    else if (!(e instanceof OutputLimit)) trap = e instanceof Error ? e.message : String(e);
  }
  return { exit, trap, stdout: state.stdout, stderr: state.stderr, truncated: state.truncated, reports: state.reports };
}
