"use client";
import { signIn } from "next-auth/react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function SignIn({
  google,
  demo,
  initialError = "",
}: {
  google: boolean;
  demo: boolean;
  initialError?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  async function login(role: string, password: string) {
    setBusy(true);
    setError("");
    try {
      const result = await signIn("local-demo", {
        role,
        password,
        redirect: false,
        callbackUrl: "/",
      });
      if (!result?.ok || result.error)
        setError("Check your local demonstration password.");
      else router.refresh();
    } catch {
      setError("Unable to sign in. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="signin-actions">
      {google && (
        <button
          className="primary-link google-signin"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await signIn("google", { callbackUrl: "/" });
            } catch {
              setError("Unable to reach Google sign-in. Please retry.");
              setBusy(false);
            }
          }}
        >
          <span className="google-letter" aria-hidden="true">
            G
          </span>
          {busy ? "Connecting…" : "Continue with Google"}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
      {!google && !demo && (
        <p className="notice">
          Google sign-in needs configuration. Follow the setup guide supplied
          with the source code.
        </p>
      )}
      {demo && (
        <details className="demo-access" open={!google || undefined}>
          <summary>
            Local development accounts
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void login(
                String(data.get("role")),
                String(data.get("password")),
              );
            }}
          >
            <p className="note">
              For local testing only. Use Google above for your real student
              account.
            </p>
            <label htmlFor="demo-role">Workspace</label>
            <select id="demo-role" name="role" disabled={busy}>
              <option value="student">Approved student</option>
              <option value="admin">TNP administrator</option>
              <option value="outsider">Unregistered student</option>
            </select>
            <label htmlFor="demo-password">Demonstration password</label>
            <input
              id="demo-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={busy}
            />
            <button className="primary-link" disabled={busy}>
              {busy ? "Signing in…" : "Open workspace"}
            </button>
          </form>
        </details>
      )}
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
    </div>
  );
}
