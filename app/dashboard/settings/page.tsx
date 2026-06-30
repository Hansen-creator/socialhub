// app/settings/page.tsx
import { Metadata } from 'next';
import SettingsClient from './SettingsClient';

export const metadata: Metadata = {
  title: 'Pengaturan Akun | SocialHub',
  description: 'Kelola informasi akun, preferensi keamanan, dan lihat detail lisensi aplikasi SocialHub kamu.',
  robots: { index: false, follow: true }, // Halaman internal/privat sebaiknya tidak diindeks Google
};

export default function SettingsPage() {
  return <SettingsClient />;
}
