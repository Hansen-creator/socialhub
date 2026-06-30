// app/chat/page.tsx
import { Metadata } from 'next';
import ChatClient from './ChatClient';

export const metadata: Metadata = {
  title: 'Ruang Obrolan & Kolaborasi Tim | SocialHub',
  description: 'Hubungkan komunikasi tim pengembang, bagikan postingan proyek, dan diskusikan kode secara real-time di SocialHub.',
  robots: { index: false, follow: true }, // Menjaga privasi halaman chat internal agar tidak diindeks publik
};

export default function ChatPage() {
  return <ChatClient />;
}
