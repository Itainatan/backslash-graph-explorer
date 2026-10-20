const STYLE: Record<string, string> = {
  critical: 'border-critical/60 bg-critical/15 text-critical',
  high: 'border-critical/60 bg-critical/15 text-critical',
  medium: 'border-finding/60 bg-finding/15 text-finding',
  low: 'border-line-strong bg-raised text-muted',
};

/** Text and colour together; never colour alone. Missing severity is shown as such, not guessed. */
export function SeverityBadge({ severity }: { severity: string | undefined }) {
  const key = severity?.toLowerCase() ?? '';
  return (
    <span className={`inline-block shrink-0 rounded border px-1.5 text-[11px] font-medium capitalize leading-[18px] ${STYLE[key] ?? 'border-line bg-raised text-muted'}`}>
      {severity ?? 'Unknown severity'}
    </span>
  );
}
