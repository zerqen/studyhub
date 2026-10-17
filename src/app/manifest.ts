import type { MetadataRoute } from "next";

// Позволяет установить StudyHub на телефон как приложение (PWA)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StudyHub — подготовка к сессии",
    short_name: "StudyHub",
    description: "Предметы, лекции, вопросы, повторение и расписание",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f8fa",
    theme_color: "#4f46e5",
    lang: "ru",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Повторение", url: "/review", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Задачи", url: "/tasks", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Календарь", url: "/calendar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
