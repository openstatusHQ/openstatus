export const validateEmailNotDisposable = async (mailHost: string) => {
  const response = await fetch(
    `https://open.kickbox.com/v1/disposable/${mailHost}`,
  );
  const status = (await response.json()) as Record<string, unknown>;

  return status.disposable;
};

export function chunk<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}
