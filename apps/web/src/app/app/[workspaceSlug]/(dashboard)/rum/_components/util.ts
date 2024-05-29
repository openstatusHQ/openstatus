export const timeFormater = (time: number) => {
  if (time < 1000) {
    return `${new Intl.NumberFormat("us").format(time).toString()}ms`;
  }
  return `${new Intl.NumberFormat("us").format(time / 1000).toString()}s`;
};
