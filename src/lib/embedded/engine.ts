import { asmTests, buildAsmRequest, buildRunRequest, buildTestRequest, outcomeFromAsm, outcomeFromRun, RUN_TIMEOUT_MS, runtimeTests, TEST_TIMEOUT_MS, testCases } from "./driver";
import type { LoadProgress, Toolchain } from "./toolchain";
import type { RunResult, Task, TestOutcome } from "./types";

export type RunReport = { log: string; built: boolean; timedOut: boolean; result: RunResult | null };
export type CheckReport = { log: string; built: boolean; outcomes: TestOutcome[] };

export async function runProgram(tc: Toolchain, task: Task, code: string, onProgress?: (p: LoadProgress) => void): Promise<RunReport> {
  const built = await tc.compile(buildRunRequest(task, code), onProgress);
  if (!built.ok) return { log: built.log, built: false, timedOut: false, result: null };
  const [first] = await tc.run(built.output, [[]], RUN_TIMEOUT_MS);
  if (first.timedOut) return { log: built.log, built: true, timedOut: true, result: null };
  return { log: built.log, built: true, timedOut: false, result: first.result };
}

export async function checkSolution(tc: Toolchain, task: Task, code: string, onProgress?: (p: LoadProgress) => void): Promise<CheckReport> {
  const built = await tc.compile(buildTestRequest(task, code), onProgress);
  if (!built.ok) return { log: built.log, built: false, outcomes: [] };
  const list = runtimeTests(task);
  const results = await tc.run(built.output, testCases(task), TEST_TIMEOUT_MS);
  const outcomes: TestOutcome[] = results.map((r, i) =>
    r.timedOut
      ? { name: list[i].name, status: "timeout", message: `Не завершилось за ${TEST_TIMEOUT_MS / 1000} с: похоже на бесконечный цикл` }
      : outcomeFromRun(list[i].name, r.result, Boolean(task.options?.sanitize)),
  );
  const asm = asmTests(task);
  if (asm.length) {
    const compiled = await tc.compile(buildAsmRequest(task, code), onProgress);
    if (!compiled.ok) return { log: compiled.log, built: false, outcomes: [] };
    const text = new TextDecoder().decode(compiled.output);
    for (const t of asm) outcomes.push(outcomeFromAsm(t, text));
  }
  return { log: built.log, built: true, outcomes };
}
