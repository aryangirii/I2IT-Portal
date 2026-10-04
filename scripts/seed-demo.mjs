import { Pool } from "pg";
if (
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL ||
  process.env.LOCAL_DEMO_ENABLED !== "true"
)
  throw new Error("Demo seeding is only allowed during local development.");
const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await db.connect();
try {
  await client.query("BEGIN");
  for (let i = 0; i < 20; i++)
    await client.query(
      "INSERT INTO students(crn,name,email,department,batch,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(crn) DO NOTHING",
      [
        "C" + (23222 + i),
        i === 0 ? "Aarav Sharma" : "Sample Student " + (i + 1),
        "student" + (i + 1) + "@example.com",
        i % 2 ? "Information Technology" : "Computer Engineering",
        "2027",
        new Date().toISOString(),
      ],
    );
  // An example URL demonstrates portal admission only. It does not create a Google meeting.
  const start = new Date(Date.now() - 5 * 60000).toISOString(),
    end = new Date(Date.now() + 60 * 60000).toISOString();
  await client.query(
    "INSERT INTO events(id,title,company,starts_at,ends_at,meeting_url,status,created_at) VALUES('demo-session','Demo pre-placement talk','Sample company',$1,$2,'https://meet.google.com/abc-defg-hij','published',$3) ON CONFLICT(id) DO UPDATE SET starts_at=excluded.starts_at,ends_at=excluded.ends_at,status='published'",
    [start, end, start],
  );
  await client.query(
    "INSERT INTO eligibility(event_id,crn) SELECT 'demo-session',crn FROM students WHERE email LIKE '%@example.com' ON CONFLICT DO NOTHING",
  );
  await client.query("COMMIT");
  console.log(
    "Seeded 20 fictional students and a demonstration event. Replace its placeholder URL with a real host-created Meet before testing a call.",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await db.end();
}
