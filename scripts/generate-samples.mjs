import { mkdir, writeFile } from "node:fs/promises";
await mkdir("public/samples", { recursive: true });
const header = "crn,name,email,department,batch\n";
for (const size of [20, 500, 5000]) {
  const rows = Array.from(
    { length: size },
    (_, i) =>
      `C${23222 + i},${i === 0 ? "Aarav Sharma" : "Sample Student " + (i + 1)},student${i + 1}@example.com,${i % 2 ? "Information Technology" : "Computer Engineering"},2027`,
  );
  await writeFile(
    `public/samples/students-${size}.csv`,
    header + rows.join("\n") + "\n",
  );
}
await writeFile(
  "public/samples/attendance-template.csv",
  "email,joined_at,left_at\nstudent1@example.com,2026-10-04T10:00:00+05:30,2026-10-04T10:45:00+05:30\n",
);
console.log(
  "Created sample student CSVs and attendance template. All identities are fictional.",
);
