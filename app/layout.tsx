import './globals.css';
import type { Metadata } from 'next';
import CircuitBackground from './components/CircuitBackground';

export const metadata: Metadata = {
  title: 'AstroFit',
  description: 'Self-hosted fitness tracker with XP, levels, and challenges.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/icons/apple-touch-icon-180x180.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AstroFit',
  },
  other: { 'mobile-web-app-capable': 'yes' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CircuitBackground />
        {children}
      </body>
    </html>
  );
}
