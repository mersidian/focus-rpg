import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  AccessDenied:
    "That GitHub account is not the one this app is locked to. Check ALLOWED_GITHUB_LOGIN in your environment.",
  Configuration:
    "The GitHub credentials on the server are missing or wrong. Check AUTH_GITHUB_ID and AUTH_GITHUB_SECRET.",
  OAuthCallback:
    "GitHub rejected the callback. The callback URL on the OAuth app must match this site exactly.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) redirect("/");

  const { error } = await searchParams;
  const message = error
    ? (ERRORS[error] ?? "Sign-in failed. Check the server logs for the reason.")
    : null;

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 sm:px-10">
      <div className="mx-auto w-full max-w-md">
        {/*
          The one deliberate exception to "Fraunces sets the earned title and
          nothing else": this is the wordmark, on the only screen where there is
          no character yet, so it cannot be mistaken for a rank.
        */}
        <h1 className="display text-hero leading-[0.95]">Focus RPG</h1>
        <p className="mt-5 max-w-prose text-[15px] leading-relaxed text-dim">
          Focused minutes, banked. One XP a minute, a hundred ranks, and ten thousand hours
          at the top of the ladder.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/" });
          }}
          className="mt-10"
        >
          <button
            type="submit"
            className="w-full rounded-sm border border-rule px-6 py-4 text-[15px] text-text transition-colors hover:border-dim"
          >
            Continue with GitHub
          </button>
        </form>

        {message && (
          <p
            className="mt-6 border-l-2 pl-4 text-[13px] leading-relaxed text-dim"
            style={{ borderColor: "var(--color-warn)" }}
          >
            {message}
          </p>
        )}

        <p className="mt-6 text-[13px] leading-relaxed text-faint">
          GitHub keeps your character on the server, so it survives a cleared browser and
          follows you to your phone.
        </p>
      </div>
    </main>
  );
}
