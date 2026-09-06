import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import { accounts, sessions, users, verificationTokens } from "./db/schema";

/**
 * Single-user app (§1), but it lives on a public URL. Set ALLOWED_GITHUB_LOGIN
 * to your GitHub username and nobody else can create a character on your
 * deployment. Leave it unset and any GitHub account may sign in.
 */
const allowedLogin = process.env.ALLOWED_GITHUB_LOGIN?.toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [GitHub],
  session: { strategy: "jwt" },
  /**
   * Behind Vercel's proxy the request host arrives as a forwarded header, which
   * Auth.js refuses to trust by default — a failure that shows up only once
   * deployed, as a sign-in redirecting to the wrong origin. Trusting it is safe
   * here: the host is Vercel's, and ALLOWED_GITHUB_LOGIN still decides who may
   * actually sign in.
   */
  trustHost: true,
  // Failures land back on the sign-in page, which explains them (§ auth).
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    signIn({ profile }) {
      if (!allowedLogin) return true;
      const login = (profile as { login?: string } | undefined)?.login;
      return typeof login === "string" && login.toLowerCase() === allowedLogin;
    },
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
});

/** Throws unless someone is signed in. Every game mutation goes through this. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Not signed in.");
  return id;
}
