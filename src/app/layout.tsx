import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Fazenda Varela IA', description: 'Gestão da fazenda em um só lugar', applicationName: 'Fazenda Varela IA', appleWebApp: { capable: true, title: 'Fazenda IA', statusBarStyle: 'black-translucent' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
