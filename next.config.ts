import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
