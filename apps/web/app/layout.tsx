import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export const metadata: Metadata = {
  title: 'LoCap — Word-timed captions and clips',
  description: 'Turn long videos into short clips with word-timed captions in English, Hindi or Hinglish, made on your own machine.',
  metadataBase: new URL(process.env.APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'LoCap — Word-timed captions and clips',
    description: 'Short clips with word-timed captions in English, Hindi or Hinglish.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}