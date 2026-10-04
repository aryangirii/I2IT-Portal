// Display known failures without reflecting arbitrary query strings or provider details.
export function signInError(code?: string): string {
  if (!code) return "";
  if (code === "AccessDenied")
    return "Sign-in was denied. Use a verified Google account or contact TNP.";
  if (code === "CredentialsSignin")
    return "Check your local demonstration password.";
  if (code === "OAuthAccountNotLinked")
    return "Sign in with the Google account you originally used.";
  return "Google sign-in could not be completed. Retry, or ask TNP to check the sign-in configuration.";
}
