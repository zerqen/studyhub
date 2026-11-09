import type { Block, Task } from "@/lib/embedded/types";
import { blockATasks } from "./block-a";

export const blocks: Block[] = [
  {
    id: "A",
    title: "Блок A. C через память",
    description: "Что на самом деле лежит в памяти и что с этим делает процессор.",
    plannedTopics: [],
  },
  {
    id: "B",
    title: "Блок B. C++ для embedded",
    description: "Возможности языка, которые не стоят лишних байтов.",
    plannedTopics: [
      "Ссылки",
      "Классы, RAII, const-корректность",
      "enum class, namespace",
      "constexpr",
      "Шаблоны на базовом уровне",
      "std::array и работа без динамической памяти",
      "Цена virtual",
      "Почему отключают исключения и RTTI",
      "Кольцевой буфер",
      "Конечный автомат",
      "Фиксированная точка",
    ],
  },
  {
    id: "C",
    title: "Блок C. Драйверы без железа",
    description: "Драйвер, который проверяется на виртуальной модели устройства.",
    plannedTopics: ["Регистры как struct поверх массива", "Интерфейс I²C и его mock", "Драйвер FM-приёмника RDA5807 на виртуальной модели", "Разбор ошибок шины"],
  },
];

export const tasks: Task[] = [...blockATasks];

export const taskBySlug = (slug: string) => tasks.find((t) => t.slug === slug);
export const tasksOfBlock = (id: string) => tasks.filter((t) => t.block === id);
