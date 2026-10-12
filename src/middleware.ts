export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/",
    "/calendar/:path*",
    "/subjects/:path*",
    "/tasks/:path*",
    "/questions/:path*",
    "/tickets/:path*",
    "/notes/:path*",
    "/files/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/search/:path*",
    "/study/:path*",
  ],
};
