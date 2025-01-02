export const validateEmailNotDisposable = async (mailHost: string) => {
  const response = await fetch(
    `https://open.kickbox.com/v1/disposable/${mailHost}`,
  );
  const status = (await response.json()) as Record<string, unknown>;

  return status.disposable;
};
