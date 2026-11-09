import type { Task } from "@/lib/embedded/types";

const A = "A";

export const blockATasks: Task[] = [
  {
    slug: "stdint-sign-extend",
    block: A,
    title: "Фиксированные типы: 12-битный АЦП",
    summary: "Расширение знака и работа с точной разрядностью",
    lang: "c",
    lecture: "Лекция 1, раздел 3",
    theory: [
      { kind: "text", md: "В `int` может быть разное число бит, а в регистре их ровно столько, сколько указано в документации. Поэтому в драйверах берут `uint8_t`, `uint16_t`, `int32_t` из `<stdint.h>`.\n\nЧасто значение уже меньше типа. Дифференциальный АЦП выдаёт 12 бит в дополнительном коде, и лежат они в младших битах `uint16_t`. Старший из этих 12 бит — знаковый. Чтобы получить верное `int16_t`, его нужно размножить в биты 12–15." },
      { kind: "diagram", caption: "Отсчёт −1 из 12-битного АЦП и он же после расширения знака", rows: [
        { label: "АЦП", cells: [{ text: "0000", tone: "muted" }, { text: "1111", tone: "accent" }, { text: "1111", tone: "accent" }, { text: "1111", tone: "accent" }] },
        { label: "int16_t", cells: [{ text: "1111", tone: "warn" }, { text: "1111", tone: "accent" }, { text: "1111", tone: "accent" }, { text: "1111", tone: "accent" }] },
      ] },
      { kind: "text", md: "**Пример.** `0xFFF` без расширения читается как 4095, а должно быть −1. Значение `0x7FF` положительное, старший из 12 бит равен нулю, и менять ничего не нужно." },
    ],
    statement: "Напиши `int16_t sign_extend12(uint16_t raw)`. Значение лежит в младших 12 битах `raw`, старшие 4 бита могут содержать мусор: их нужно игнорировать.",
    starter: `#include <stdint.h>
#include <stdio.h>

int16_t sign_extend12(uint16_t raw) {
    // твой код
    return 0;
}

int main(void) {
    printf("%d\\n", sign_extend12(0xFFF));  // ожидаем -1
    return 0;
}
`,
    solution: `#include <stdint.h>

int16_t sign_extend12(uint16_t raw) {
    raw &= 0x0FFF;
    if (raw & 0x0800) {
        raw |= 0xF000;
    }
    return (int16_t)raw;
}
`,
    wrongSolutions: [
      { name: "Нет расширения знака", code: `#include <stdint.h>\nint16_t sign_extend12(uint16_t raw) { return (int16_t)(raw & 0x0FFF); }\n` },
      { name: "Мусор не отброшен", code: `#include <stdint.h>\nint16_t sign_extend12(uint16_t raw) { if (raw & 0x800) return (int16_t)(raw | 0xF000); return (int16_t)raw; }\n` },
    ],
    hints: ["Сначала обнули всё, что выше бита 11: маска `0x0FFF`.", "Проверь бит 11. Если он равен 1, число отрицательное.", "Для отрицательного числа установи биты 12–15 маской `0xF000` и приведи к `int16_t`."],
    tests: [
      { name: "Ноль", code: "CHECK_INT(sign_extend12(0x000), 0);" },
      { name: "Наибольшее положительное", code: "CHECK_INT(sign_extend12(0x7FF), 2047);" },
      { name: "Наименьшее отрицательное", code: "CHECK_INT(sign_extend12(0x800), -2048);" },
      { name: "Минус единица", code: "CHECK_INT(sign_extend12(0xFFF), -1);" },
      { name: "Мусор в старших битах, положительное", code: "CHECK_INT(sign_extend12(0xF123), 291);" },
      { name: "Мусор в старших битах, отрицательное", code: "CHECK_INT(sign_extend12(0x5FFE), -2);" },
    ],
  },
  {
    slug: "promotion-overflow-ub",
    block: A,
    title: "Integer promotion, переполнение и UB",
    summary: "Сложение с насыщением без неопределённого поведения",
    lang: "c",
    lecture: "Лекция 1, раздел 5",
    options: { sanitize: true },
    theory: [
      { kind: "text", md: "Переполнение `int32_t` — неопределённое поведение (UB). Проверять его **после** сложения поздно: оптимизатор считает, что переполнения не бывает, и может выбросить такую проверку. Сравнивать надо заранее, через безопасную разность.\n\nВторая ловушка — integer promotion: `uint16_t` в выражении становится знаковым `int`. Поэтому `a * b` при `a = b = 0xFFFF` переполняет `int`, хотя оба типа беззнаковые." },
      { kind: "diagram", caption: "Почему произведение двух uint16_t может быть UB", rows: [
        { label: "a × b", cells: [{ text: "65535" }, { text: "×" , tone: "muted"}, { text: "65535" }] },
        { label: "тип", cells: [{ text: "int (знаковый, 32 бита)", tone: "warn" }] },
        { label: "итог", cells: [{ text: "4 294 836 225 > INT32_MAX", tone: "warn" }] },
      ] },
      { kind: "text", md: "**Пример.** `a > INT32_MAX - b` при положительном `b` проверяет переполнение, не вызывая его: разность здесь всегда представима.\n\nВ этом задании включён UBSan: при UB программа сразу останавливается, и тест это покажет." },
    ],
    statement: "Напиши две функции.\n\n`int32_t sat_add_i32(int32_t a, int32_t b)` возвращает сумму, а при переполнении — `INT32_MAX` или `INT32_MIN`.\n\n`uint32_t mul_u16(uint16_t a, uint16_t b)` возвращает точное произведение. Неопределённого поведения быть не должно.",
    starter: `#include <stdint.h>
#include <stdio.h>

int32_t sat_add_i32(int32_t a, int32_t b) {
    return a + b;
}

uint32_t mul_u16(uint16_t a, uint16_t b) {
    return a * b;
}

int main(void) {
    printf("%d\\n", sat_add_i32(2000000000, 2000000000));
    printf("%u\\n", mul_u16(1000, 1000));
    return 0;
}
`,
    solution: `#include <stdint.h>

int32_t sat_add_i32(int32_t a, int32_t b) {
    if (b > 0 && a > INT32_MAX - b) return INT32_MAX;
    if (b < 0 && a < INT32_MIN - b) return INT32_MIN;
    return a + b;
}

uint32_t mul_u16(uint16_t a, uint16_t b) {
    return (uint32_t)a * b;
}
`,
    wrongSolutions: [
      { name: "Проверка после сложения", code: `#include <stdint.h>\nint32_t sat_add_i32(int32_t a, int32_t b) { int32_t r = a + b; if (a > 0 && b > 0 && r < 0) return INT32_MAX; if (a < 0 && b < 0 && r > 0) return INT32_MIN; return r; }\nuint32_t mul_u16(uint16_t a, uint16_t b) { return (uint32_t)a * b; }\n` },
      { name: "Умножение в int", code: `#include <stdint.h>\nint32_t sat_add_i32(int32_t a, int32_t b) { if (b > 0 && a > INT32_MAX - b) return INT32_MAX; if (b < 0 && a < INT32_MIN - b) return INT32_MIN; return a + b; }\nuint32_t mul_u16(uint16_t a, uint16_t b) { return a * b; }\n` },
    ],
    hints: ["Для `b > 0` переполнение случится, если `a` больше, чем `INT32_MAX - b`.", "Для `b < 0` условие зеркальное: `a < INT32_MIN - b`.", "В `mul_u16` приведи один из множителей к `uint32_t` до умножения."],
    tests: [
      { name: "Обычная сумма", code: "CHECK_INT(sat_add_i32(2, 3), 5);" },
      { name: "Сумма с отрицательным", code: "CHECK_INT(sat_add_i32(-7, 3), -4);" },
      { name: "Насыщение сверху", code: "CHECK_INT(sat_add_i32(INT32_MAX, 1), INT32_MAX);" },
      { name: "Насыщение снизу", code: "CHECK_INT(sat_add_i32(INT32_MIN, -1), INT32_MIN);" },
      { name: "Граница: MAX + MIN", code: "CHECK_INT(sat_add_i32(INT32_MAX, INT32_MIN), -1);" },
      { name: "Максимальные слагаемые", code: "CHECK_INT(sat_add_i32(INT32_MAX, INT32_MAX), INT32_MAX);" },
      { name: "Произведение без переполнения", code: "CHECK_UINT(mul_u16(1000, 1000), 1000000);" },
      { name: "Произведение 0xFFFF × 0xFFFF", code: "CHECK_UINT(mul_u16(0xFFFF, 0xFFFF), 4294836225u);" },
    ],
  },
  {
    slug: "pointers-arrays",
    block: A,
    title: "Указатели и диапазоны",
    summary: "Проход по памяти от begin до end",
    lang: "c",
    lecture: "Лекция 2, разделы 1–3",
    theory: [
      { kind: "text", md: "Диапазон удобно задавать двумя указателями: `begin` указывает на первый элемент, `end` — **на место сразу за последним**. Такой адрес получить можно, а читать по нему нельзя.\n\nЕсли элемент не найден, функция возвращает `end`. Пустой диапазон — это просто `begin == end`, и особый случай не нужен." },
      { kind: "diagram", caption: "Диапазон из четырёх байт", rows: [
        { label: "память", cells: [{ text: "10", sub: "begin", tone: "accent" }, { text: "20" }, { text: "30" }, { text: "40" }, { text: "?", sub: "end", tone: "warn" }] },
      ] },
      { kind: "code", code: "for (const uint8_t* p = begin; p != end; ++p) {\n    // *p — текущий элемент\n}" },
    ],
    statement: "Напиши `const uint8_t* find_byte(const uint8_t* begin, const uint8_t* end, uint8_t value)`. Верни указатель на **первый** байт, равный `value`, или `end`, если такого нет.",
    starter: `#include <stdint.h>
#include <stdio.h>

const uint8_t* find_byte(const uint8_t* begin, const uint8_t* end, uint8_t value) {
    // твой код
    return end;
}

int main(void) {
    uint8_t data[] = {10, 20, 30};
    const uint8_t* p = find_byte(data, data + 3, 20);
    printf("%d\\n", (int)(p - data));  // ожидаем 1
    return 0;
}
`,
    solution: `#include <stdint.h>

const uint8_t* find_byte(const uint8_t* begin, const uint8_t* end, uint8_t value) {
    for (const uint8_t* p = begin; p != end; ++p) {
        if (*p == value) return p;
    }
    return end;
}
`,
    wrongSolutions: [
      { name: "Возвращает NULL, если не найдено", code: `#include <stdint.h>\n#include <stddef.h>\nconst uint8_t* find_byte(const uint8_t* begin, const uint8_t* end, uint8_t value) { for (const uint8_t* p = begin; p != end; ++p) if (*p == value) return p; return NULL; }\n` },
      { name: "Находит последнее вхождение", code: `#include <stdint.h>\nconst uint8_t* find_byte(const uint8_t* begin, const uint8_t* end, uint8_t value) { const uint8_t* r = end; for (const uint8_t* p = begin; p != end; ++p) if (*p == value) r = p; return r; }\n` },
    ],
    hints: ["Цикл идёт, пока `p != end`.", "При совпадении сразу делай `return p`: так найдётся первое вхождение.", "После цикла верни `end`."],
    prelude: "static const uint8_t D[] = {7, 9, 9, 200, 0};",
    tests: [
      { name: "Первый элемент", code: "CHECK_INT(find_byte(D, D + 5, 7) - D, 0);" },
      { name: "В середине", code: "CHECK_INT(find_byte(D, D + 5, 200) - D, 3);" },
      { name: "Последний элемент", code: "CHECK_INT(find_byte(D, D + 5, 0) - D, 4);" },
      { name: "Первое из повторов", code: "CHECK_INT(find_byte(D, D + 5, 9) - D, 1);" },
      { name: "Нет в диапазоне", code: "CHECK_TRUE(find_byte(D, D + 5, 42) == D + 5);" },
      { name: "Пустой диапазон", code: "CHECK_TRUE(find_byte(D + 2, D + 2, 9) == D + 2);" },
      { name: "Значение сразу за концом не считается", code: "CHECK_TRUE(find_byte(D, D + 3, 200) == D + 3);" },
    ],
  },
  {
    slug: "struct-padding",
    block: A,
    title: "struct, выравнивание и разбор пакета",
    summary: "Пакет на проводе и структура в памяти устроены по-разному",
    lang: "c",
    lecture: "Лекция 3, раздел 2",
    theory: [
      { kind: "text", md: "Компилятор вставляет в структуру пустые байты, чтобы поля лежали по кратным адресам. В пакете с датчика никаких пустых байтов нет, поэтому `memcpy` всей структуры или приведение указателя дают неверные данные.\n\nНадёжный способ — собрать каждое поле из байтов вручную. Так заодно не зависишь от порядка байтов процессора." },
      { kind: "diagram", caption: "Один и тот же набор полей", rows: [
        { label: "пакет", cells: [{ text: "id", tone: "accent" }, { text: "t0" }, { text: "t1" }, { text: "t2" }, { text: "t3" }, { text: "r0", tone: "accent" }, { text: "r1", tone: "accent" }] },
        { label: "struct", cells: [{ text: "id", tone: "accent" }, { text: "·", tone: "warn" }, { text: "·", tone: "warn" }, { text: "·", tone: "warn" }, { text: "t0" }, { text: "t1" }, { text: "t2" }, { text: "t3" }, { text: "r0", tone: "accent" }, { text: "r1", tone: "accent" }, { text: "·", tone: "warn" }, { text: "·", tone: "warn" }] },
      ] },
      { kind: "code", code: "uint16_t v = (uint16_t)(p[0] | ((uint16_t)p[1] << 8));  // little-endian" },
      { kind: "text", md: "В браузере невыровненный доступ работает. На Cortex-M0 такое обращение к слову вызывает HardFault, поэтому привычка собирать значения из байтов полезна вдвойне." },
    ],
    statement: "Пакет занимает 7 байт: `id` (1 байт), `time` (4 байта, little-endian), `raw` (2 байта, little-endian). Напиши `void parse_sample(const uint8_t* buf, struct Sample* out)`. Порядок полей в `struct Sample` не меняй.",
    starter: `#include <stdint.h>
#include <stdio.h>

struct Sample {
    uint8_t id;
    uint32_t time;
    uint16_t raw;
};

void parse_sample(const uint8_t* buf, struct Sample* out) {
    // твой код
}

int main(void) {
    uint8_t packet[7] = {5, 0x78, 0x56, 0x34, 0x12, 0xCD, 0xAB};
    struct Sample s;
    parse_sample(packet, &s);
    printf("%d %X %X\\n", s.id, s.time, s.raw);
    return 0;
}
`,
    solution: `#include <stdint.h>

struct Sample {
    uint8_t id;
    uint32_t time;
    uint16_t raw;
};

void parse_sample(const uint8_t* buf, struct Sample* out) {
    out->id = buf[0];
    out->time = (uint32_t)buf[1] | ((uint32_t)buf[2] << 8) | ((uint32_t)buf[3] << 16) | ((uint32_t)buf[4] << 24);
    out->raw = (uint16_t)(buf[5] | ((uint16_t)buf[6] << 8));
}
`,
    wrongSolutions: [
      { name: "memcpy всей структуры", code: `#include <stdint.h>\n#include <string.h>\nstruct Sample { uint8_t id; uint32_t time; uint16_t raw; };\nvoid parse_sample(const uint8_t* buf, struct Sample* out) { memcpy(out, buf, sizeof *out); }\n` },
      { name: "Порядок big-endian", code: `#include <stdint.h>\nstruct Sample { uint8_t id; uint32_t time; uint16_t raw; };\nvoid parse_sample(const uint8_t* buf, struct Sample* out) { out->id = buf[0]; out->time = ((uint32_t)buf[1] << 24) | ((uint32_t)buf[2] << 16) | ((uint32_t)buf[3] << 8) | buf[4]; out->raw = (uint16_t)((buf[5] << 8) | buf[6]); }\n` },
    ],
    hints: ["Поле `id` — это просто `buf[0]`.", "`time` начинается с `buf[1]`: младший байт без сдвига, следующие со сдвигами 8, 16 и 24.", "Приводи байт к `uint32_t` до сдвига на 24, иначе сдвиг идёт в знаковом `int`."],
    prelude: "static const uint8_t P[] = {0xEE, 5, 0x78, 0x56, 0x34, 0x12, 0xCD, 0xAB, 0xEE};\nstatic const uint8_t Q[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};",
    tests: [
      { name: "Поле id", code: "struct Sample s; parse_sample(P + 1, &s); CHECK_INT(s.id, 5);" },
      { name: "Поле time, little-endian", code: "struct Sample s; parse_sample(P + 1, &s); CHECK_HEX(s.time, 0x12345678);" },
      { name: "Поле raw, little-endian", code: "struct Sample s; parse_sample(P + 1, &s); CHECK_HEX(s.raw, 0xABCD);" },
      { name: "Все биты единичные", code: "struct Sample s; parse_sample(Q, &s); CHECK_INT(s.id, 255); CHECK_HEX(s.time, 0xFFFFFFFFu); CHECK_HEX(s.raw, 0xFFFF);" },
      { name: "Размер структуры с padding", code: "CHECK_UINT(sizeof(struct Sample), 12);" },
      { name: "Смещение поля time", code: "CHECK_UINT(offsetof(struct Sample, time), 4);" },
    ],
  },
  {
    slug: "bit-fields-masks",
    block: A,
    title: "Битовые операции и маски",
    summary: "Запись поля регистра, не трогая соседние биты",
    lang: "c",
    lecture: "Лекция 2, раздел 10",
    options: { sanitize: true },
    theory: [
      { kind: "text", md: "В одном регистре лежит несколько настроек. Чтобы записать одну, используют шаблон «прочитать, изменить, записать»: сначала очистить поле маской, затем поставить новое значение.\n\nЗаписи `reg |= x` не хватает: единицы она поставит, а нули — нет." },
      { kind: "diagram", caption: "Запись значения 0b10 в поле width = 2, shift = 4", rows: [
        { label: "reg", cells: [{ text: "1" }, { text: "0" }, { text: "1", tone: "warn" }, { text: "1", tone: "warn" }, { text: "0" }, { text: "1" }, { text: "1" }, { text: "0" }] },
        { label: "после", cells: [{ text: "1" }, { text: "0" }, { text: "1", tone: "accent" }, { text: "0", tone: "accent" }, { text: "0" }, { text: "1" }, { text: "1" }, { text: "0" }] },
      ] },
      { kind: "text", md: "**Граница.** Сдвиг на ширину типа — UB, поэтому `(1u << 32) - 1` писать нельзя. Маску из `width` единиц можно получить сдвигом вправо: `0xFFFFFFFFu >> (32 - width)` при `width` от 1 до 32." },
    ],
    statement: "Напиши `uint32_t reg_set_field(uint32_t reg, unsigned shift, unsigned width, uint32_t value)`. Верни `reg`, в котором поле из `width` бит, начиная с бита `shift`, заменено на `value`. Лишние биты `value` отбрасываются. Гарантировано `1 ≤ width ≤ 32` и `shift + width ≤ 32`.",
    starter: `#include <stdint.h>
#include <stdio.h>

uint32_t reg_set_field(uint32_t reg, unsigned shift, unsigned width, uint32_t value) {
    // твой код
    return reg;
}

int main(void) {
    printf("%X\\n", reg_set_field(0xB6, 4, 2, 2));  // ожидаем A6
    return 0;
}
`,
    solution: `#include <stdint.h>

uint32_t reg_set_field(uint32_t reg, unsigned shift, unsigned width, uint32_t value) {
    uint32_t mask = 0xFFFFFFFFu >> (32 - width);
    reg &= ~(mask << shift);
    reg |= (value & mask) << shift;
    return reg;
}
`,
    wrongSolutions: [
      { name: "Маска через 1u << width", code: `#include <stdint.h>\nuint32_t reg_set_field(uint32_t reg, unsigned shift, unsigned width, uint32_t value) { uint32_t mask = (1u << width) - 1; reg &= ~(mask << shift); reg |= (value & mask) << shift; return reg; }\n` },
      { name: "Поле не очищается", code: `#include <stdint.h>\nuint32_t reg_set_field(uint32_t reg, unsigned shift, unsigned width, uint32_t value) { uint32_t mask = 0xFFFFFFFFu >> (32 - width); reg |= (value & mask) << shift; return reg; }\n` },
    ],
    hints: ["Сначала построй маску из `width` единиц в младших битах.", "Очисти поле: `reg &= ~(mask << shift)`.", "Запиши значение, обрезав его маской: `(value & mask) << shift`."],
    tests: [
      { name: "Пример из условия", code: "CHECK_HEX(reg_set_field(0xB6, 4, 2, 2), 0xA6);" },
      { name: "Соседние биты не меняются", code: "CHECK_HEX(reg_set_field(0xFFFFFFFFu, 8, 4, 0), 0xFFFFF0FFu);" },
      { name: "Лишние биты value отброшены", code: "CHECK_HEX(reg_set_field(0, 0, 3, 0xFF), 0x7);" },
      { name: "Поле на всю ширину", code: "CHECK_HEX(reg_set_field(0x12345678, 0, 32, 0xCAFEBABEu), 0xCAFEBABEu);" },
      { name: "Старшие биты регистра", code: "CHECK_HEX(reg_set_field(0x0FFFFFFF, 28, 4, 0xA), 0xAFFFFFFFu);" },
      { name: "Один бит", code: "CHECK_HEX(reg_set_field(0, 13, 1, 1), 0x2000);" },
    ],
  },
  {
    slug: "volatile-const-static",
    block: A,
    title: "volatile, const и static",
    summary: "Что запрещают оптимизатору и что скрывают от других",
    lang: "c",
    lecture: "Лекция 2, раздел 10; лекция 1, раздел 9",
    theory: [
      { kind: "text", md: "Значение в регистре может измениться само. Без `volatile` компилятор вправе прочитать его один раз и использовать копию. С `volatile` каждое чтение в коде остаётся чтением из памяти.\n\n`const` здесь означает другое: **эта функция** не будет писать через указатель. Регистр только для чтения объявляют `const volatile`, и противоречия тут нет.\n\n`static` внутри функции создаёт переменную, которая живёт всю программу, но видна только в этой функции." },
      { kind: "diagram", caption: "Что остаётся от двух чтений после оптимизации", rows: [
        { label: "без volatile", cells: [{ text: "load", tone: "accent" }, { text: "сложить с собой", tone: "muted" }] },
        { label: "с volatile", cells: [{ text: "load", tone: "accent" }, { text: "load", tone: "accent" }, { text: "сложить", tone: "muted" }] },
      ] },
      { kind: "text", md: "Один из тестов смотрит на ассемблер после `-O2`: там должно быть два чтения." },
    ],
    statement: "Напиши две функции.\n\n`uint32_t read_twice(const volatile uint32_t* reg)` читает регистр два раза и возвращает сумму.\n\n`unsigned next_id(void)` при каждом вызове возвращает следующее число: 1, 2, 3… Глобальных переменных не используй.",
    starter: `#include <stdint.h>
#include <stdio.h>

uint32_t read_twice(uint32_t* reg) {
    return *reg + *reg;
}

unsigned next_id(void) {
    // твой код
    return 0;
}

int main(void) {
    printf("%u %u\\n", next_id(), next_id());
    return 0;
}
`,
    solution: `#include <stdint.h>

uint32_t read_twice(const volatile uint32_t* reg) {
    uint32_t first = *reg;
    uint32_t second = *reg;
    return first + second;
}

unsigned next_id(void) {
    static unsigned id = 0;
    id += 1;
    return id;
}
`,
    wrongSolutions: [
      { name: "Нет volatile", code: `#include <stdint.h>\nuint32_t read_twice(const uint32_t* reg) { return *reg + *reg; }\nunsigned next_id(void) { static unsigned id = 0; id += 1; return id; }\n` },
      { name: "Счётчик не static", code: `#include <stdint.h>\nuint32_t read_twice(const volatile uint32_t* reg) { uint32_t a = *reg; uint32_t b = *reg; return a + b; }\nunsigned next_id(void) { unsigned id = 0; id += 1; return id; }\n` },
    ],
    hints: ["Тип параметра: `const volatile uint32_t*`.", "Два чтения удобно записать в две отдельные переменные: порядок вычислений тогда очевиден.", "Для счётчика внутри функции нужна `static unsigned id = 0;`."],
    tests: [
      { name: "Сумма двух чтений", code: "uint32_t r = 21; CHECK_UINT(read_twice(&r), 42);" },
      { name: "Тип параметра const volatile", code: "CHECK_TRUE(_Generic(&read_twice, uint32_t (*)(const volatile uint32_t*): 1, default: 0));" },
      { name: "Два чтения после -O2", asm: { fn: "read_twice", op: "i32.load", min: 2 } },
      { name: "Первый вызов next_id", code: "CHECK_UINT(next_id(), 1);" },
      { name: "Значения идут подряд", code: "next_id(); next_id(); CHECK_UINT(next_id(), 3);" },
      { name: "Много вызовов", code: "unsigned v = 0; for (int i = 0; i < 1000; i++) v = next_id(); CHECK_UINT(v, 1000);" },
    ],
  },
  {
    slug: "memory-regions-heap",
    block: A,
    title: "Стек, куча, .data и .bss",
    summary: "Время жизни памяти и обработка отказа malloc",
    lang: "c",
    lecture: "Лекция 1, раздел 9; лекция 2, раздел 9",
    options: { trackHeap: true },
    theory: [
      { kind: "text", md: "Где лежит объект, определяет, сколько он живёт. Локальная переменная исчезает при выходе из функции, `static` живёт всю программу и существует в одном экземпляре, память из кучи живёт до `free`.\n\nНа микроконтроллере `malloc` может вернуть `NULL`, и эту ситуацию надо обрабатывать." },
      { kind: "diagram", caption: "Области памяти SRAM", rows: [
        { label: "SRAM", cells: [{ text: ".data", tone: "accent" }, { text: ".bss", tone: "accent" }, { text: "куча →", tone: "warn" }, { text: "свободно", tone: "muted" }, { text: "← стек", tone: "accent" }] },
      ] },
      { kind: "text", md: "**Пример.** Буфер в `static uint8_t buf[N]` нельзя вернуть двум пользователям: второй вызов испортит данные первого. Массив на стеке вернуть нельзя вовсе." },
    ],
    statement: "Напиши `uint8_t* buf_create(size_t n, uint8_t fill)`: выдели `n` байт из кучи и заполни их `fill`. Если `n == 0` или память не выделилась, верни `NULL`. Напиши `void buf_destroy(uint8_t* p)`: освободи память. `NULL` допустим.",
    starter: `#include <stdint.h>
#include <stdlib.h>
#include <stdio.h>

uint8_t* buf_create(size_t n, uint8_t fill) {
    // твой код
    return NULL;
}

void buf_destroy(uint8_t* p) {
    // твой код
}

int main(void) {
    uint8_t* a = buf_create(3, 7);
    if (a) printf("%d\\n", a[2]);
    buf_destroy(a);
    return 0;
}
`,
    solution: `#include <stdint.h>
#include <stdlib.h>
#include <string.h>

uint8_t* buf_create(size_t n, uint8_t fill) {
    if (n == 0) return NULL;
    uint8_t* p = malloc(n);
    if (p == NULL) return NULL;
    memset(p, fill, n);
    return p;
}

void buf_destroy(uint8_t* p) {
    free(p);
}
`,
    wrongSolutions: [
      { name: "Статический буфер вместо кучи", code: `#include <stdint.h>\n#include <stdlib.h>\n#include <string.h>\nstatic uint8_t s[1024];\nuint8_t* buf_create(size_t n, uint8_t fill) { if (n == 0) return NULL; memset(s, fill, n); return s; }\nvoid buf_destroy(uint8_t* p) { (void)p; }\n` },
      { name: "Утечка: free не вызывается", code: `#include <stdint.h>\n#include <stdlib.h>\n#include <string.h>\nuint8_t* buf_create(size_t n, uint8_t fill) { if (n == 0) return NULL; uint8_t* p = malloc(n); if (p == NULL) return NULL; memset(p, fill, n); return p; }\nvoid buf_destroy(uint8_t* p) { (void)p; }\n` },
    ],
    hints: ["Первой строкой обработай `n == 0`.", "После `malloc` обязательно проверь результат на `NULL`.", "Заполнить удобно через `memset`. В `buf_destroy` достаточно `free(p)`: `free(NULL)` безопасен."],
    tests: [
      { name: "Все байты заполнены", code: "uint8_t* p = buf_create(4, 0xAB); CHECK_TRUE(p != NULL); for (int i = 0; i < 4; i++) CHECK_HEX(p[i], 0xAB); buf_destroy(p);" },
      { name: "n == 0 даёт NULL без выделения", code: "CHECK_TRUE(buf_create(0, 1) == NULL); CHECK_INT(sh_heap_live(), 0);" },
      { name: "Отказ malloc даёт NULL", code: "sh_fail_next_alloc(); CHECK_TRUE(buf_create(8, 1) == NULL);" },
      { name: "После destroy нет утечки", code: "uint8_t* p = buf_create(16, 0); CHECK_INT(sh_heap_live(), 1); buf_destroy(p); CHECK_INT(sh_heap_live(), 0);" },
      { name: "Два буфера независимы", code: "uint8_t* a = buf_create(4, 1); uint8_t* b = buf_create(4, 2); CHECK_TRUE(a != b); CHECK_INT(a[0], 1); CHECK_INT(b[0], 2); buf_destroy(a); buf_destroy(b);" },
      { name: "destroy(NULL) безопасен", code: "buf_destroy(NULL); CHECK_INT(sh_heap_live(), 0);" },
    ],
  },
  {
    slug: "function-pointers",
    block: A,
    title: "Указатели на функции",
    summary: "Обратные вызовы и таблица обработчиков",
    lang: "c",
    theory: [
      { kind: "text", md: "Функция тоже лежит по адресу, и его можно хранить в переменной. Так устроены таблица векторов прерываний, обработчики команд и драйверы с подменяемым интерфейсом.\n\nТип читается изнутри наружу: `bool (*pred)(int32_t)` — указатель на функцию, которая принимает `int32_t` и возвращает `bool`. Псевдоним через `typedef` делает запись короче." },
      { kind: "diagram", caption: "Таблица команд: индекс выбирает функцию", rows: [
        { label: "индекс", cells: [{ text: "0" }, { text: "1" }, { text: "2" }] },
        { label: "адрес", cells: [{ text: "cmd_read", tone: "accent" }, { text: "NULL", tone: "warn" }, { text: "cmd_reset", tone: "accent" }] },
      ] },
      { kind: "code", code: "typedef int (*handler_t)(int);\nint result = table[cmd](arg);  // вызов по адресу из таблицы" },
      { kind: "text", md: "Индекс нужно проверять до обращения: выход за таблицу означает прыжок по случайному адресу." },
    ],
    statement: "Напиши две функции.\n\n`size_t filter_ints(const int32_t* in, size_t n, int32_t* out, bool (*pred)(int32_t))` копирует в `out` элементы, для которых `pred` истинно, сохраняя порядок, и возвращает их количество.\n\n`int run_command(const handler_t* table, size_t count, size_t cmd, int arg)` вызывает `table[cmd](arg)`. Если `cmd >= count` или обработчик равен `NULL`, верни −1.",
    starter: `#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

typedef int (*handler_t)(int);

size_t filter_ints(const int32_t* in, size_t n, int32_t* out, bool (*pred)(int32_t)) {
    // твой код
    return 0;
}

int run_command(const handler_t* table, size_t count, size_t cmd, int arg) {
    // твой код
    return -1;
}

static int twice(int x) { return 2 * x; }

int main(void) {
    handler_t table[] = {twice};
    printf("%d\\n", run_command(table, 1, 0, 21));  // ожидаем 42
    return 0;
}
`,
    solution: `#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

typedef int (*handler_t)(int);

size_t filter_ints(const int32_t* in, size_t n, int32_t* out, bool (*pred)(int32_t)) {
    size_t count = 0;
    for (size_t i = 0; i < n; ++i) {
        if (pred(in[i])) {
            out[count] = in[i];
            count += 1;
        }
    }
    return count;
}

int run_command(const handler_t* table, size_t count, size_t cmd, int arg) {
    if (cmd >= count || table[cmd] == NULL) return -1;
    return table[cmd](arg);
}
`,
    wrongSolutions: [
      { name: "Ошибка на границе таблицы", code: `#include <stdbool.h>\n#include <stddef.h>\n#include <stdint.h>\ntypedef int (*handler_t)(int);\nsize_t filter_ints(const int32_t* in, size_t n, int32_t* out, bool (*pred)(int32_t)) { size_t c = 0; for (size_t i = 0; i < n; ++i) if (pred(in[i])) out[c++] = in[i]; return c; }\nint run_command(const handler_t* table, size_t count, size_t cmd, int arg) { if (cmd > count || table[cmd] == NULL) return -1; return table[cmd](arg); }\n` },
      { name: "Предикат не используется", code: `#include <stdbool.h>\n#include <stddef.h>\n#include <stdint.h>\ntypedef int (*handler_t)(int);\nsize_t filter_ints(const int32_t* in, size_t n, int32_t* out, bool (*pred)(int32_t)) { (void)pred; for (size_t i = 0; i < n; ++i) out[i] = in[i]; return n; }\nint run_command(const handler_t* table, size_t count, size_t cmd, int arg) { if (cmd >= count || table[cmd] == NULL) return -1; return table[cmd](arg); }\n` },
    ],
    hints: ["В `filter_ints` нужен отдельный счётчик записанных элементов.", "Указатель на функцию вызывается как обычная функция: `pred(in[i])`.", "В `run_command` сначала проверь `cmd >= count`, и только потом читай `table[cmd]`."],
    prelude: `static bool is_even(int32_t x) { return x % 2 == 0; }
static bool never(int32_t x) { (void)x; return false; }
static bool always(int32_t x) { (void)x; return true; }
static int inc(int x) { return x + 1; }
static int neg(int x) { return -x; }
static int boom(int x) { (void)x; return 99; }
static const handler_t T[] = {inc, NULL, neg, boom};
static const int32_t IN[] = {1, 2, 3, 4, 6};`,
    tests: [
      { name: "Фильтр сохраняет порядок", code: "int32_t o[5]; CHECK_UINT(filter_ints(IN, 5, o, is_even), 3); CHECK_INT(o[0], 2); CHECK_INT(o[1], 4); CHECK_INT(o[2], 6);" },
      { name: "Ни один элемент не подошёл", code: "int32_t o[5]; CHECK_UINT(filter_ints(IN, 5, o, never), 0);" },
      { name: "Подошли все", code: "int32_t o[5]; CHECK_UINT(filter_ints(IN, 5, o, always), 5); CHECK_INT(o[4], 6);" },
      { name: "Пустой вход", code: "int32_t o[1]; CHECK_UINT(filter_ints(IN, 0, o, always), 0);" },
      { name: "Вызов обработчика", code: "CHECK_INT(run_command(T, 3, 0, 41), 42); CHECK_INT(run_command(T, 3, 2, 5), -5);" },
      { name: "Пустой обработчик", code: "CHECK_INT(run_command(T, 3, 1, 5), -1);" },
      { name: "Индекс равен размеру таблицы", code: "CHECK_INT(run_command(T, 3, 3, 5), -1);" },
    ],
  },
  {
    slug: "linkage-multiple-files",
    block: A,
    title: "Компоновка и несколько файлов",
    summary: "Внешние и внутренние имена, ошибки линкера",
    lang: "c",
    lecture: "Лекция 1, раздел 8",
    extraFiles: {
      "counter.h": `#pragma once\n\nvoid counter_inc(void);\nunsigned counter_get(void);\nunsigned other_value(void);\n`,
      "other.c": `// Этот файл уже есть в проекте, и менять его нельзя\nunsigned value = 100;\n\nunsigned other_value(void) {\n    return value;\n}\n`,
    },
    theory: [
      { kind: "text", md: "Глобальное имя видно из всех файлов программы. Если два файла определяют одно и то же имя, линкер сообщит об ошибке `duplicate symbol`.\n\n`static` у глобальной переменной или функции ограничивает её **одним файлом**. Это внутренняя компоновка: другой файл может использовать то же имя без конфликта. Слово то же, что и у локальной `static`, но смысл другой." },
      { kind: "diagram", caption: "Два файла, два разных value", rows: [
        { label: "other.c", cells: [{ text: "value = 100", sub: "виден всем", tone: "warn" }] },
        { label: "solution.c", cells: [{ text: "static value", sub: "только этот файл", tone: "accent" }] },
      ] },
      { kind: "text", md: "**Пример.** В заголовке пишут только объявления. Если определить в нём переменную без `static`, она появится в каждом файле, который подключает заголовок, и линкер выдаст ту же ошибку." },
    ],
    statement: "В проекте есть `other.c` с глобальной переменной `value`. В своём файле заведи счётчик с **тем же именем** `value`, начальное значение 0, и реализуй `counter_inc` и `counter_get` из `counter.h`. Проект должен собраться, а значение в `other.c` не должно меняться.",
    starter: `#include "counter.h"
#include <stdio.h>

unsigned value = 0;

void counter_inc(void) {
    value += 1;
}

unsigned counter_get(void) {
    return value;
}

int main(void) {
    counter_inc();
    printf("%u %u\\n", counter_get(), other_value());
    return 0;
}
`,
    solution: `#include "counter.h"

static unsigned value = 0;

void counter_inc(void) {
    value += 1;
}

unsigned counter_get(void) {
    return value;
}
`,
    wrongSolutions: [
      { name: "Глобальное имя конфликтует", code: `#include "counter.h"\nunsigned value = 0;\nvoid counter_inc(void) { value += 1; }\nunsigned counter_get(void) { return value; }\n` },
      { name: "Используется чужая переменная", code: `#include "counter.h"\nextern unsigned value;\nvoid counter_inc(void) { value += 1; }\nunsigned counter_get(void) { return value; }\n` },
    ],
    hints: ["Прочитай ошибку линкера: какое имя определено дважды?", "Имя менять нельзя. Нужно сделать его видимым только в этом файле.", "Добавь `static` перед определением `value`."],
    tests: [
      { name: "Счётчик начинается с нуля", code: "CHECK_UINT(counter_get(), 0);" },
      { name: "Один вызов", code: "counter_inc(); CHECK_UINT(counter_get(), 1);" },
      { name: "Несколько вызовов", code: "for (int i = 0; i < 5; i++) counter_inc(); CHECK_UINT(counter_get(), 5);" },
      { name: "Значение в other.c сразу после старта", code: "CHECK_UINT(other_value(), 100);" },
      { name: "Счётчик не затрагивает other.c", code: "counter_inc(); counter_inc(); CHECK_UINT(other_value(), 100);" },
    ],
  },
];
