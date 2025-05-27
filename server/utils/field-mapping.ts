export function mapFieldsToObject<T extends object>(source: T, fields: Array<keyof T>): Partial<T> {
  const result: Partial<T> = {};
  for (const field of fields) {
    if (source[field] !== undefined) {
      result[field] = source[field];
    }
  }
  return result;
}
