// app/page.js
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { userId } = auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  console.log("ADMIN EMAIL:", ADMIN_EMAIL);
  const isAdmin = user.emailAddresses.some(
    (email) => email.emailAddress === ADMIN_EMAIL
  );

  if (isAdmin) {
    redirect("/admin");
  } else {
    redirect("/client");
  }
}
