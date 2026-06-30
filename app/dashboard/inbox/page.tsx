// app/inbox/page.tsx
import { Metadata } from 'next';
import InboxClient from './InboxClient';

export const metadata: Metadata = {
  title: 'Kotak Masuk & Notifikasi | SocialHub',
  description: 'Pantau semua interaksi, komentar, suka, dan pesan masuk dari komunitas developer kamu di SocialHub.',
  robots: { index: false, follow: true }, // Mengamankan halaman internal agar tidak diindeks publik
};

export default function InboxPage() {
  return <InboxClient />;
}
