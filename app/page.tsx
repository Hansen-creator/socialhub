// app/page.tsx
import { Metadata } from 'next';
import LoginClient from './LoginClient'; // Kita pindahkan UI client ke sini

// Menambahkan Metadata untuk menaikkan skor SEO dan CTR
export const metadata: Metadata = {
  title: 'Masuk ke SocialHub | Platform Produktivitas Komunitas Developer',
  description: 'Masuk ke SocialHub untuk mengelola tugas, berkolaborasi dengan tim, dan meningkatkan produktivitas pengembang profesional.',
  openGraph: {
    title: 'SocialHub - Platform Produktivitas Komunitas',
    description: 'Kelola proyek dan bangun komunitas developer profesional dalam satu platform terintegrasi.',
    images: ['/logo.svg'],
  },
};

export default function LoginPage() {
  return <LoginClient />;
}
