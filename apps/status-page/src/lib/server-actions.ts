export async function generateServerActionPromise<T>(
  promise: Promise<{ success: boolean; error?: string; data?: T }>,
): Promise<T | undefined> {
  const { success, data, error } = await promise;
  if (!success) {
    throw new Error(error);
  }
  return data;
}
