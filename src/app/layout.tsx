import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Fazenda Varela IA', description: 'Gestão da fazenda em um só lugar' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
