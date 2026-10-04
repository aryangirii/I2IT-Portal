import Link from "next/link";
export default function NotFound() {
  return (
    <main className="signin">
      <h1>Page not found</h1>
      <Link className="primary-link" href="/">
        Return to Placement Desk
      </Link>
    </main>
  );
}
