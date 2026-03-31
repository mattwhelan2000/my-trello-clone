"use server"

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  const password = formData.get("password");

  if (password === "goodthinc") {
    // Await cookies in modern Next.js 
    const cookieStore = await cookies();
    cookieStore.set("site_auth", "goodthinc", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    
    // Redirect to home upon success
    redirect("/");
  } else {
    // If you wanted to do error handling, we would return error state here.
    // Since it's a simple form action, we will just return or throw an error, 
    // but the easiest is just let it fail silently or return for now.
    // For simplicity, we just redirect back to /login with an error.   
  }
  
  redirect("/login?error=IncorrectPassword");
}
