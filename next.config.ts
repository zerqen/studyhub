import type { NextConfig } from "next";

/** Заголовки безопасности для всех ответов */
const securityHeaders = [
  // Сайт нельзя встроить в чужую страницу (защита от кликджекинга); формы — только на свой сайт
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Только HTTPS (2 года)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Микрофон нужен для голосового ввода и записи лекций, камера — для фото тетради через <input capture>
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    // Интерактивные схемы (/api/interactive/…) отдают свои заголовки: их можно встраивать в страницы сайта
    return [
      { source: "/", headers: securityHeaders },
      { source: "/:path((?!api/interactive/).*)", headers: securityHeaders },
    ];
  },
  serverExternalPackages: ["bcryptjs", "@prisma/client"],
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
    // Клиент держит уже открытые страницы 30 с: «назад» и повторные переходы — мгновенно
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    // Импортировать только используемые иконки
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
};

export default nextConfig;
