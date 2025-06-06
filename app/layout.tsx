import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PDF要約アプリ',
  description: 'WebLLMを使用したローカルPDF要約アプリケーション',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
