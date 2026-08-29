export function toggleRange(
  selected: ReadonlySet<string>,
  orderedIds: string[],
  index: number,
  shift: boolean,
  anchor: number | null,
): Set<string> {
  const next = new Set(selected);
  if (shift && anchor != null) {
    const from = Math.min(anchor, index);
    const to = Math.max(anchor, index);
    for (let i = from; i <= to; i++) {
      const id = orderedIds[i];
      if (id) next.add(id);
    }
    return next;
  }
  const id = orderedIds[index];
  if (!id) return next;
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
