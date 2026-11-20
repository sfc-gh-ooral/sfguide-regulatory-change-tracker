// Obliqa logo mark (docs/DESIGN.md): a page with one redlined line and a check.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect x="5" y="3" width="22" height="26" rx="3" fill="#FFFFFF" stroke="#17191E" strokeWidth="2" />
      <path d="M21 3v6h6" fill="none" stroke="#17191E" strokeWidth="2" />
      <path d="M10 13h11" stroke="#B42318" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M10 18h6" stroke="#17191E" strokeWidth="2" strokeLinecap="round" opacity=".35" />
      <path d="M10 23l3 3 6-6" fill="none" stroke="#1F6F4A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
