import { HttpError } from "@/lib/server";
export function googleAdmission(url: string, email: string) {
  const destination = new URL(url);
  if (
    destination.protocol !== "https:" ||
    destination.hostname !== "meet.google.com" ||
    !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(destination.pathname) ||
    destination.search ||
    destination.hash ||
    destination.username ||
    destination.password
  )
    throw new HttpError(
      503,
      "Meeting configuration needs administrator attention.",
    );
  return {
    url: destination.href,
    email,
    provider: "google",
    attendance_recorded: false,
  };
}
