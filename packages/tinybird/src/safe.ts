export async function safePipeData<T>(
  promise: Promise<{ data: T[] }>,
  label: string,
): Promise<{ data: T[] }> {
  try {
    return await promise;
  } catch (err) {
    console.error(`[tinybird] ${label} failed, returning empty data:`, err);
    return { data: [] };
  }
}
