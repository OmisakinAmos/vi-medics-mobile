/** Simple horizontal bar list used by the admin reports and accounting pages. */
export function Bars({ rows, format = (n: number) => String(n) }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="report-bars">
      {rows.map((r) => (
        <div key={r.label} className="report-bar-row">
          <span className="report-bar-label">{r.label}</span>
          <span className="report-bar-track"><span className="report-bar-fill" style={{ width: `${(Math.max(0, r.value) / max) * 100}%` }} /></span>
          <strong>{format(r.value)}</strong>
        </div>
      ))}
    </div>
  );
}
