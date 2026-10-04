"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="signin">
      <h1>We could not load your workspace.</h1>
      <p>Please retry. If this continues, contact TNP.</p>
      <button className="primary-link" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
