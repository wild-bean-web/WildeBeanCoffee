import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = ["/login", "/reset-password", "/api/health", "/api/webhooks"];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

const productionHosts = new Set([
  "wild-bean-manager.vercel.app",
  "wild-bean-manager-lastsamurailijs-projects.vercel.app",
]);

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();

  if (host && productionHosts.has(host) && !pathname.startsWith("/api/")) {
    const destination = new URL(request.url);
    destination.protocol = "https:";
    destination.host = "manager.wildbeancoffeeshop.com";
    return NextResponse.redirect(destination, 308);
  }

  if (isPublicPath(pathname)) {
    return response;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const demoMode =
    process.env.MANAGER_DEMO_MODE === "true" && !isProduction;
  if (demoMode) {
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
