/** Формат контента раздела Embedded. Новое задание добавляется данными, без изменения движка. */

export type Lang = "c" | "cpp";

export type DiagramTone = "accent" | "muted" | "warn" | "plain";
export type DiagramCell = { text: string; sub?: string; tone?: DiagramTone };

export type TheoryBlock =
  | { kind: "text"; md: string }
  | { kind: "code"; code: string }
  | { kind: "diagram"; caption: string; rows: { label?: string; cells: DiagramCell[] }[] };

/** Обычный тест выполняет C-код с макросами CHECK_*; проверка ассемблера смотрит на код после оптимизации */
export type TestCase =
  | { name: string; code: string }
  | { name: string; asm: { fn: string; op: string; min: number } };

export type TaskOptions = {
  /** Неопределённое поведение останавливает программу (UBSan в режиме trap) */
  sanitize?: boolean;
  /** Подменить malloc/free счётчиками: sh_heap_live(), sh_fail_next_alloc() */
  trackHeap?: boolean;
};

export type Task = {
  slug: string;
  block: string;
  title: string;
  summary: string;
  lang: Lang;
  /** Где подробно: ссылка на лекцию словами */
  lecture?: string;
  theory: TheoryBlock[];
  statement: string;
  starter: string;
  solution: string;
  /** Типичные неверные решения: каждое обязано не пройти проверку */
  wrongSolutions: { name: string; code: string }[];
  hints: string[];
  /** Код перед тестами: вспомогательные функции */
  prelude?: string;
  tests: TestCase[];
  options?: TaskOptions;
  /** Дополнительные файлы: *.c и *.cpp компилируются, остальные только подключаются */
  extraFiles?: Record<string, string>;
  /** Платформа, на которой выполняется задание. Сейчас только браузер; позже появится эмулятор */
  target?: "wasm32";
};

export type Block = {
  id: string;
  title: string;
  description: string;
  /** Темы, для которых заданий пока нет */
  plannedTopics: string[];
};

export type CompileRequest = {
  tool: "clang" | "clang++";
  args: string[];
  files: Record<string, string>;
  output: string;
};

export type RunResult = {
  exit: number;
  trap: string | null;
  stdout: string;
  stderr: string;
  truncated: boolean;
  reports: { ok: boolean; expr: string; got: string; expected: string }[];
};

export type TestOutcome = {
  name: string;
  status: "passed" | "failed" | "timeout" | "crashed";
  /** Какая проверка не прошла */
  expr?: string;
  got?: string;
  expected?: string;
  message?: string;
};
