import { auth } from "@/auth";
import { NextResponse } from "next/server";

const publicPaths = ["/login", "/invite"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic =
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/integrations");

  if (!req.auth && !isPublic) {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  if (req.auth && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (pathname.startsWith("/admin") && req.auth) {
    const role = (req.auth.user as { role?: string })?.role;

    if (role === "ADMIN") {
      return NextResponse.next();
    }

    if (role === "MANAGER") {
      const allowed =
        pathname === "/admin" ||
        pathname.startsWith("/admin/courses") ||
        pathname.startsWith("/admin/exams") ||
        pathname.startsWith("/admin/grades") ||
        pathname.startsWith("/admin/grading");
      if (allowed) return NextResponse.next();
      return NextResponse.redirect(new URL("/admin/courses", req.nextUrl.origin));
    }

    if (
      role === "COURSE_ADMIN" &&
      (pathname.startsWith("/admin/grading") ||
        pathname.startsWith("/admin/grades") ||
        pathname === "/admin")
    ) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
