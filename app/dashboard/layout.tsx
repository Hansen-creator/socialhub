import Sidebar from '../components/Sidebar'; // Sesuaikan path jika folder components ada di dalam src/
import { ReactNode } from 'react';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f4f4f9', color: '#333' }}>
      {/* Memanggil Component Sidebar */}
      <Sidebar />

      {/* Konten Utama */}
      <main style={{ flex: 1, padding: '30px' }}>
        {children}
      </main>
    </div>
  );
}