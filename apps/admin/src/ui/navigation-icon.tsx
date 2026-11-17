const paths: Record<string, string> = {
  home: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  units: 'M3 10.5 12 3l9 7.5M5 9v12h14V9M9 21v-7h6v7',
  bookings: 'M7 3v4m10-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 8h3m-3 4h3',
  countries: 'M3 5h18v14H3z M8 5v14M16 5v14M3 12h18',
  cities: 'M3 21h18M5 21V9h6v12M11 21V3h8v18M8 12v2M14 7h2M14 11h2M14 15h2',
  currencies: 'M12 3v18M16 7H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H7',
  unitCategories: 'M3 11l9-8 9 8M5 10v11h14V10M9 21v-8h6v8',
  admins:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  pricingSettings: 'M4 7h16M4 17h16M9 4v6M15 14v6',
};
export function NavigationIcon({ name }: { name: string }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 opacity-80"
    >
      <path d={paths[name] ?? paths.unitCategories} />
      {name === 'admins' && <circle cx="9" cy="7" r="4" />}
    </svg>
  );
}
