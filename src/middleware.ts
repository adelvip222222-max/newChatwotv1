import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

function isProtectedPlatformPath(pathname: string) {
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/developer") ||
    pathname.startsWith("/api/developer")
  );
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    const isSuperAdmin = token?.isSuperAdmin === true || token?.role === "super-admin";

    if (isSuperAdmin && pathname.startsWith("/dashboard") && !pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    if (isProtectedPlatformPath(pathname) && !isSuperAdmin) {
      if (isApiPath(pathname)) {
        return NextResponse.json(
          { message: "Forbidden: super-admin access is required." },
          { status: 403 }
        );
      }

      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ token }) {
        return !!token;
      }
    },
    pages: {
      signIn: "/login"
    }
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/developer",
    "/developer/:path*",
    "/api/admin/:path*",
    "/api/developer/:path*",
    "/api/knowledge/:path*"
  ]
};
