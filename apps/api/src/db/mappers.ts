export function toCamel<T = any>(row: Record<string, any>): T {
  const result: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = row[key];
  }
  return result as T;
}

export function toCamelList<T = any>(rows: Record<string, any>[]): T[] {
  return rows.map((row) => toCamel<T>(row));
}
