export function parseCSV(text: string): Record<string, string>[] {
  if (text.length > 1000000) throw new Error("File exceeds 1 MB.");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted) quoted = false;
      else if (!cell) quoted = true;
      else throw new Error("Invalid CSV quotation.");
    } else if (!quoted && (c === "," || c === "\n" || c === "\r")) {
      row.push(cell);
      cell = "";
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed CSV quotation.");
  if (cell || row.length) {
    row.push(cell);
    if (row.some((v) => v.trim())) rows.push(row);
  }
  if (rows.length < 2)
    throw new Error("Add a header row and at least one data row.");
  const headers = rows.shift()!.map((v) => v.trim().toLowerCase());
  if (new Set(headers).size !== headers.length)
    throw new Error("Duplicate column names.");
  if (rows.length > 5000)
    throw new Error("Import at most 5,000 rows per file.");
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw new Error(`Row ${i + 2}: wrong number of columns.`);
    return Object.fromEntries(headers.map((h, j) => [h, r[j].trim()]));
  });
}
export function toCSV(rows: Record<string, unknown>[], keys: string[]) {
  const esc = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    keys.map(esc).join(","),
    ...rows.map((r) => keys.map((k) => esc(r[k])).join(",")),
  ].join("\r\n");
}
