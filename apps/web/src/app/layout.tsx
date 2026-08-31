import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display-loaded',
  display: 'swap',
});

const body = Figtree({
  subsets: ['latin'],
  variable: '--font-body-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cambeo — hot seat',
  description: 'Local hot-seat Cambeo driving the rules engine directly',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body
        style={
          {
            '--font-display': 'var(--font-display-loaded), system-ui, sans-serif',
            '--font-body': 'var(--font-body-loaded), system-ui, sans-serif',
          } as CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
