import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let the user access the login page
  if (pathname === "/login") {
    // If they already have the correct cookie, redirect them to home instead 
    if (request.cookies.get("site_auth")?.value === "goodthinc") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Check for the site-wide password cookie
  const authCookie = request.cookies.get("site_auth");

  if (!authCookie || authCookie.value !== "goodthinc") {
    // Redirect to login if they are not authenticated
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except API, static resources, and images
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
