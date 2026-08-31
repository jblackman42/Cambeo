import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-ui-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Cambeo',
  description: 'Real-time multiplayer Cambeo (house-ruled Cambio)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${roboto.className} ${roboto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
