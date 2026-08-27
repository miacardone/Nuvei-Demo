/** Signed change indicator. Colour follows direction, arrow carries the meaning
 *  for anyone who cannot distinguish the hues. */
export function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium tnum ${
        up ? "text-success" : "text-danger"
      }`}
    >
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      {up ? "+" : ""}
      {value.toFixed(1)}%
      <span className="sr-only">{up ? "increase" : "decrease"}</span>
    </span>
  );
}
