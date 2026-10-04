// A small parameterized repository interface keeps SQL services independent of the host.
export interface QueryResult<T = Record<string, unknown>> {
  results: T[];
  changes: number;
}
export interface PreparedStatement {
  bind(...values: unknown[]): PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<QueryResult<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<QueryResult>;
}
export interface Database {
  prepare(sql: string): PreparedStatement;
  batch(
    statements: PreparedStatement[],
    validate?: (results: QueryResult[]) => void,
  ): Promise<QueryResult[]>;
}
export interface Executor {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
}
// SQL strings are owned by our services. User values are always bound parameters.
function parameters(sql: string) {
  let i = 0;
  return sql.replace(/\?/g, () => "$" + ++i);
}
function normalize(rows: Record<string, unknown>[]) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k,
        typeof v === "bigint" ||
        (typeof v === "string" && /^(n|count|eligible_count|blocked)$/.test(k))
          ? Number(v)
          : v,
      ]),
    ),
  );
}
export class Statement implements PreparedStatement {
  constructor(
    readonly sql: string,
    readonly values: unknown[],
    private readonly executor: Executor,
  ) {}
  bind(...values: unknown[]) {
    return new Statement(this.sql, values, this.executor);
  }
  async all<T = Record<string, unknown>>(): Promise<QueryResult<T>> {
    const result = await this.executor.query(parameters(this.sql), this.values);
    return {
      results: normalize(result.rows) as T[],
      changes: result.rowCount ?? 0,
    };
  }
  async first<T = Record<string, unknown>>() {
    return (await this.all<T>()).results[0] ?? null;
  }
  run() {
    return this.all();
  }
}
export class SqlDatabase implements Database {
  constructor(
    private readonly executor: Executor,
    private readonly transaction: (
      fn: (executor: Executor) => Promise<QueryResult[]>,
    ) => Promise<QueryResult[]>,
  ) {}
  prepare(sql: string) {
    return new Statement(sql, [], this.executor);
  }
  async batch(
    statements: PreparedStatement[],
    validate?: (results: QueryResult[]) => void,
  ) {
    return this.transaction(async (executor) => {
      const results: QueryResult[] = [];
      for (const statement of statements) {
        if (!(statement instanceof Statement))
          throw new Error("Invalid SQL statement");
        results.push(
          await new Statement(statement.sql, statement.values, executor).all(),
        );
      }
      validate?.(results);
      return results;
    });
  }
}
