"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/setup", label: "Setup" },
  { href: "/doctors", label: "Doctors" },
  { href: "/schedule/2026-03", label: "Schedule" },
  { href: "/reports", label: "Reports" }
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className='nav-shell'>
      <Link href='/' className='brand'>
        MedShift NSGA-II
      </Link>
      <div className='menu-row'>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              pathname?.startsWith(item.href) ? "menu-item active" : "menu-item"
            }>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
