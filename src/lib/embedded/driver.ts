import type { CompileRequest, RunResult, Task, TestCase, TestOutcome } from "./types";

/** Версия пакета @yowasp/clang: папка с файлами компилятора. Тест сверяет её с package-lock. */
export const COMPILER_VERSION = "22.0.0-git20542-10";
export const COMPILER_BASE = `/wasm/compiler/${COMPILER_VERSION}/`;

export const RUN_TIMEOUT_MS = 3000;
export const TEST_TIMEOUT_MS = 2000;
export const COMPILE_TIMEOUT_MS = 30000;
export const OUTPUT_LIMIT = 64 * 1024;

export const TEST_HEADER = String.raw`#ifndef SH_TEST_H
#define SH_TEST_H
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

__attribute__((import_module("studyhub"), import_name("report")))
void sh_report(int ok, const char* expr, const char* got, const char* expected);

static inline void sh_check_int(const char* e, long long got, long long want) {
  char a[32], b[32];
  snprintf(a, sizeof a, "%lld", got);
  snprintf(b, sizeof b, "%lld", want);
  sh_report(got == want, e, a, b);
}
static inline void sh_check_uint(const char* e, unsigned long long got, unsigned long long want) {
  char a[32], b[32];
  snprintf(a, sizeof a, "%llu", got);
  snprintf(b, sizeof b, "%llu", want);
  sh_report(got == want, e, a, b);
}
static inline void sh_check_hex(const char* e, unsigned long long got, unsigned long long want) {
  char a[32], b[32];
  snprintf(a, sizeof a, "0x%llX", got);
  snprintf(b, sizeof b, "0x%llX", want);
  sh_report(got == want, e, a, b);
}
static inline void sh_check_true(const char* e, int value) {
  sh_report(value != 0, e, value ? "истина" : "ложь", "истина");
}
#define CHECK_INT(actual, want) sh_check_int(#actual, (long long)(actual), (long long)(want))
#define CHECK_UINT(actual, want) sh_check_uint(#actual, (unsigned long long)(actual), (unsigned long long)(want))
#define CHECK_HEX(actual, want) sh_check_hex(#actual, (unsigned long long)(actual), (unsigned long long)(want))
#define CHECK_TRUE(value) sh_check_true(#value, (value) ? 1 : 0)

#ifdef SH_TRACK_HEAP
static int sh_live = 0;
static int sh_fail = 0;
static inline int sh_heap_live(void) { return sh_live; }
static inline void sh_fail_next_alloc(void) { sh_fail = 1; }
static inline void* sh_malloc(size_t n) {
  if (sh_fail) { sh_fail = 0; return NULL; }
  void* p = malloc(n);
  if (p) sh_live += 1;
  return p;
}
static inline void sh_free(void* p) {
  if (p) sh_live -= 1;
  free(p);
}
#define malloc sh_malloc
#define free sh_free
#endif
#endif
`;

const sourceName = (task: Task) => (task.lang === "c" ? "solution.c" : "solution.cpp");
const driverName = (task: Task) => (task.lang === "c" ? "sh_driver.c" : "sh_driver.cpp");
const tool = (task: Task): CompileRequest["tool"] => (task.lang === "c" ? "clang" : "clang++");

function languageFlags(task: Task) {
  return task.lang === "c" ? ["-std=c11"] : ["-std=c++17", "-fno-exceptions", "-fno-rtti"];
}

/** char на ARM беззнаковый, поэтому и здесь тоже; стек маленький и лежит первым: переполнение сразу ловится */
const COMMON = ["-funsigned-char", "-Wl,--stack-first", "-Wl,-z,stack-size=65536", "-Wl,--max-memory=33554432"];

function extraSources(task: Task) {
  return Object.keys(task.extraFiles ?? {}).filter((f) => /\.(c|cpp)$/.test(f));
}

export function isRuntimeTest(test: TestCase): test is { name: string; code: string } {
  return "code" in test;
}
export const runtimeTests = (task: Task) => task.tests.filter(isRuntimeTest);
export const asmTests = (task: Task) => task.tests.filter((t): t is Extract<TestCase, { asm: unknown }> => "asm" in t);

/** Сборка для кнопки «Запустить»: код как есть, с предупреждениями */
export function buildRunRequest(task: Task, code: string): CompileRequest {
  return {
    tool: tool(task),
    args: [sourceName(task), ...extraSources(task), ...languageFlags(task), "-Wall", "-Wextra", "-O1", ...COMMON, "-o", "a.wasm"],
    files: { [sourceName(task)]: code, ...task.extraFiles },
    output: "a.wasm",
  };
}

export function buildDriver(task: Task) {
  const tests = runtimeTests(task);
  const lines = [
    task.options?.trackHeap ? "#define SH_TRACK_HEAP" : "",
    '#include "sh_test.h"',
    "#define main sh_user_main",
    `#include "${sourceName(task)}"`,
    "#undef main",
    task.prelude ?? "",
    ...tests.map((t, i) => `static void sh_case_${i}(void) {\n${t.code}\n}`),
    "int main(int argc, char** argv) {",
    "  if (argc < 2) return 2;",
    "  switch (atoi(argv[1])) {",
    ...tests.map((_, i) => `    case ${i}: sh_case_${i}(); break;`),
    "    default: return 2;",
    "  }",
    "  return 0;",
    "}",
    "",
  ];
  return lines.join("\n");
}

/** Сборка для «Проверить»: код пользователя подключается в файл с тестами */
export function buildTestRequest(task: Task, code: string): CompileRequest {
  const sanitize = task.options?.sanitize ? ["-fsanitize=undefined", "-fsanitize-trap=undefined"] : [];
  return {
    tool: tool(task),
    args: [driverName(task), ...extraSources(task), ...languageFlags(task), "-w", "-O1", ...sanitize, ...COMMON, "-o", "a.wasm"],
    files: { [driverName(task)]: buildDriver(task), [sourceName(task)]: code, "sh_test.h": TEST_HEADER, ...task.extraFiles },
    output: "a.wasm",
  };
}

/** Код после оптимизации: для проверок вроде volatile */
export function buildAsmRequest(task: Task, code: string): CompileRequest {
  return {
    tool: tool(task),
    args: [sourceName(task), ...languageFlags(task), "-w", "-O2", "-funsigned-char", "-S", "-o", "a.s"],
    files: { [sourceName(task)]: code, ...task.extraFiles },
    output: "a.s",
  };
}

export const testCases = (task: Task) => runtimeTests(task).map((_, i) => [String(i)]);

export function outcomeFromRun(name: string, result: RunResult, sanitized: boolean): TestOutcome {
  const failed = result.reports.find((r) => !r.ok);
  if (failed) return { name, status: "failed", expr: failed.expr, got: failed.got, expected: failed.expected };
  if (result.trap) {
    const message = sanitized
      ? `Программа остановлена: неопределённое поведение или ошибка памяти (${result.trap})`
      : `Программа упала: ${result.trap}`;
    return { name, status: "crashed", message };
  }
  if (result.exit !== 0) return { name, status: "crashed", message: `Программа завершилась с кодом ${result.exit}` };
  if (result.reports.length === 0) return { name, status: "failed", message: "Тест не выполнил ни одной проверки" };
  return { name, status: "passed" };
}

/** Считает инструкции внутри функции в тексте WebAssembly-ассемблера */
export function countAsmOps(asm: string, fn: string, op: string) {
  const lines = asm.split("\n");
  const start = lines.findIndex((l) => l.startsWith(`${fn}:`));
  if (start < 0) return null;
  let count = 0;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith("end_function")) break;
    if (line.split(/\s+/)[0] === op) count += 1;
  }
  return count;
}

export function outcomeFromAsm(test: Extract<TestCase, { asm: unknown }>, asm: string): TestOutcome {
  const count = countAsmOps(asm, test.asm.fn, test.asm.op);
  if (count === null) return { name: test.name, status: "failed", message: `Функция ${test.asm.fn} не найдена` };
  if (count < test.asm.min) {
    return { name: test.name, status: "failed", expr: `${test.asm.op} в ${test.asm.fn}`, got: String(count), expected: `не меньше ${test.asm.min}` };
  }
  return { name: test.name, status: "passed" };
}

/** Текст для вставки в чат с Claude */
export function buildReviewText(task: Task, code: string, outcomes: TestOutcome[] | null, compileLog: string) {
  const parts = [`Задание: ${task.title}`, "", task.statement, "", "Мой код:", "```" + task.lang, code.trimEnd(), "```"];
  if (compileLog.trim()) parts.push("", "Компилятор:", "```", compileLog.trim(), "```");
  if (outcomes) {
    parts.push("", "Результаты тестов:");
    for (const t of outcomes) {
      if (t.status === "passed") parts.push(`- [ok] ${t.name}`);
      else {
        const detail = t.expr ? `${t.expr}: получено ${t.got}, ожидалось ${t.expected}` : (t.message ?? "");
        parts.push(`- [${t.status === "timeout" ? "таймаут" : "ошибка"}] ${t.name}: ${detail}`);
      }
    }
  }
  parts.push("", "Разбери решение: что неверно и почему, с учётом того, как это работает на микроконтроллере.");
  return parts.join("\n");
}
