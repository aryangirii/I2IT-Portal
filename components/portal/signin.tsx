"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function SignIn({ google, demo }: { google: boolean; demo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
      if (result?.error) setError("Check your local demonstration password.");
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
          className="primary-link"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void signIn("google", { callbackUrl: "/" });
          }}
        >
          Continue with Google
        </button>
      )}
      {!google && !demo && (
        <p className="notice">
          Google sign-in needs configuration. Follow the setup guide supplied
          with the source code.
        </p>
      )}
      {demo && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void login(String(data.get("role")), String(data.get("password")));
          }}
        >
          <p className="note">Local demonstration accounts</p>
          <label htmlFor="demo-role">Workspace</label>
          <select id="demo-role" name="role">
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
          />
          <button className="primary-link" disabled={busy}>
            {busy ? "Signing in…" : "Open workspace"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
    </div>
  );
}
