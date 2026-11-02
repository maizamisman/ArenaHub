/* eslint-disable @next/next/no-img-element */
export function Brand({ flags = 2 }: { flags?: 1 | 2 }) {
  return (
    <span className="brand">
      <img src="/flags/flag-a.svg" alt="" />
      {flags === 2 && <img src="/flags/flag-h.svg" alt="" />}
      <span>Arena <em>Hub</em></span>
    </span>
  );
}
