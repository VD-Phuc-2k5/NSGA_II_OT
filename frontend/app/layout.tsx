import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='vi'>
      <body>
        <div className='bg-orb bg-orb-a' />
        <div className='bg-orb bg-orb-b' />
        <main className='app-shell'>
          <Nav />
          {children}
        </main>
      </body>
    </html>
  );
}
