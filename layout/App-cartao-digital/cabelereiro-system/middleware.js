import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware((auth, req) => {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const userEmail = auth.user?.primaryEmailAddress?.emailAddress;

  if (isProtectedAdminRoute(req) && userEmail !== adminEmail) {
    const url = new URL("/client", req.url);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!_next|favicon.ico|sign-in|sign-up|api/webhooks).*)",
    "/(api|trpc)(.*)",
  ],
};
