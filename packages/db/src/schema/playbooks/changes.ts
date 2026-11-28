/** Non-blank lines only in `before` and only in `after`, each in its own order. */
export function playbookLineChanges(
  before: string,
  after: string,
): { removed: string[]; added: string[] } {
  const a = before.split("\n");
  const b = after.split("\n");
  // longest common subsequence of the lines from (i, j) on, as a flat table
  const width = b.length + 1;
  const table = new Uint16Array((a.length + 1) * width);
  const lcs = (i: number, j: number) => table[i * width + j] ?? 0;
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? lcs(i + 1, j + 1) + 1
          : Math.max(lcs(i + 1, j), lcs(i, j + 1));
    }
  }
  const removed: string[] = [];
  const added: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (
      j === b.length ||
      (i < a.length && lcs(i + 1, j) >= lcs(i, j + 1))
    ) {
      removed.push(a[i++] ?? "");
    } else {
      added.push(b[j++] ?? "");
    }
  }
  const written = (line: string) => line.trim() !== "";
  return { removed: removed.filter(written), added: added.filter(written) };
}
