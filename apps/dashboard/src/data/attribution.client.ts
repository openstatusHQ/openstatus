type Attributed<U> = {
  createdByUser: U | null;
  updatedByUser: U | null;
};

/** The last editor, only when it is someone other than the author. */
export function distinctEditor<U extends { id: number }>(
  row: Attributed<U>,
): U | null {
  const { createdByUser, updatedByUser } = row;
  return updatedByUser && updatedByUser.id !== createdByUser?.id
    ? updatedByUser
    : null;
}
