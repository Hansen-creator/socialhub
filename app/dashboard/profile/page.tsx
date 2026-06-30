// app/profile/page.tsx
import { Metadata } from 'next';
import ProfileClient from './ProfileClient';

export const metadata: Metadata = {
  title: 'Profil Saya | SocialHub Workspace',
  description: 'Lihat repositori post, aktivitas komunitas, repost, dan portofolio interaktif pengembang di SocialHub.',
  openGraph: {
    title: 'Profil Pengembang - SocialHub',
    description: 'Ruang kolaborasi dan publikasi proyek inovatif.',
  },
};

export default function MyProfilePage() {
  return <ProfileClient />;
}
