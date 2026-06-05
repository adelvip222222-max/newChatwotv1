import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized({ token, req }) {
      if (!token) return false;
      if (
        req.nextUrl.pathname.startsWith("/admin") ||
        req.nextUrl.pathname.startsWith("/api/admin") ||
        req.nextUrl.pathname.startsWith("/api/knowledge")
      ) {
        return token.role === "owner" || token.role === "admin";
      }
      return true;
    }
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/admin/:path*", "/api/knowledge/:path*"]
};
