// Проверка контента: эталон каждого задания проходит все тесты, а каждое неверное решение падает.
// Запускает настоящий компилятор, поэтому вынесена из npm test: npm run check:embedded
import { commands } from "@yowasp/clang";
import { tasks } from "../src/content/embedded";
import { asmTests, buildAsmRequest, buildTestRequest, outcomeFromAsm, outcomeFromRun, runtimeTests, testCases } from "../src/lib/embedded/driver";
import type { CompileRequest, RunResult, Task, TestOutcome } from "../src/lib/embedded/types";
// @ts-expect-error обычный JS-модуль из public
import { runModule } from "../public/wasm/run-core.js";

type Compiled = { ok: true; output: Uint8Array; log: string } | { ok: false; log: string };

async function compile(req: CompileRequest): Promise<Compiled> {
  let log = "";
  const decoder = new TextDecoder();
  const sink = (b: Uint8Array | null) => {
    if (b) log += decoder.decode(b, { stream: true });
  };
  try {
    const tree = await commands[req.tool](req.args, req.files, { stdout: sink, stderr: sink });
    const value = (tree as Record<string, string | Uint8Array>)[req.output];
    return { ok: true, output: typeof value === "string" ? new TextEncoder().encode(value) : (value as Uint8Array), log };
  } catch (e) {
    if (e && typeof e === "object" && "code" in e) return { ok: false, log };
    throw e;
  }
}

async function evaluate(task: Task, code: string): Promise<{ outcomes: TestOutcome[]; log: string }> {
  const built = await compile(buildTestRequest(task, code));
  if (!built.ok) return { outcomes: [{ name: "Сборка", status: "failed", message: built.log }], log: built.log };
  const program = await WebAssembly.compile(built.output as BufferSource);
  const cases = testCases(task);
  const list = runtimeTests(task);
  const outcomes = cases.map((args, i) => outcomeFromRun(list[i].name, runModule(program, { args }) as RunResult, Boolean(task.options?.sanitize)));
  const asm = asmTests(task);
  if (asm.length) {
    const s = await compile(buildAsmRequest(task, code));
    if (!s.ok) outcomes.push({ name: "Ассемблер", status: "failed", message: s.log });
    else for (const t of asm) outcomes.push(outcomeFromAsm(t, new TextDecoder().decode(s.output)));
  }
  return { outcomes, log: built.log };
}

let failures = 0;
for (const task of tasks) {
  const good = await evaluate(task, task.solution);
  const bad = good.outcomes.filter((o) => o.status !== "passed");
  console.log(`${bad.length ? "FAIL" : "ok  "} ${task.slug}: эталон ${good.outcomes.length - bad.length}/${good.outcomes.length}`);
  for (const o of bad) {
    failures += 1;
    console.log("     ", o.name, o.status, o.expr ?? "", o.got ?? "", o.expected ?? "", o.message ?? "");
  }
  // Заготовка не должна случайно проходить
  const starter = await evaluate(task, task.starter);
  if (starter.outcomes.every((o) => o.status === "passed")) {
    failures += 1;
    console.log("  FAIL заготовка проходит все тесты");
  }
  for (const wrong of task.wrongSolutions) {
    const r = await evaluate(task, wrong.code);
    const fails = r.outcomes.filter((o) => o.status !== "passed");
    if (fails.length === 0) failures += 1;
    console.log(`  ${fails.length ? "ok  " : "FAIL"} неверное «${wrong.name}»: падает ${fails.length}, например: ${fails[0]?.name ?? "—"}`);
  }
}
if (failures) {
  console.error(`Проблем: ${failures}`);
  process.exit(1);
}
console.log("Все задания проверены");
