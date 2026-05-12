'use client';

import { useRouter } from 'next/navigation';

interface ProfileMenuProps {
  uid: string;
  userName: string;
  onClose: () => void;
}

export default function ProfileMenuModal({ uid, userName, onClose }: ProfileMenuProps) {
  const router = useRouter();

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
      <div style={{ backgroundColor: 'white', width: '320px', borderRadius: '25px', overflow: 'hidden', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
        
        {/* Header Singkat */}
        <div style={{ padding: '25px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#4285F4', margin: '0 auto 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontSize: '28px', fontWeight: 'bold' }}>
            {userName?.charAt(0).toUpperCase()}
          </div>
          <strong style={{ fontSize: '18px', color: '#333' }}>{userName}</strong>
        </div>

        {/* Opsi: Lihat Profil */}
        <div 
          onClick={() => {
            router.push(`/dashboard/profile/${uid}`);
            onClose();
          }}
          style={{ padding: '18px', cursor: 'pointer', fontWeight: 'bold', color: '#444', borderBottom: '1px solid #f0f0f0', transition: '0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          👤 Lihat Profil Lengkap
        </div>

        {/* Opsi: Lihat Story */}
        <div 
          onClick={() => {
            router.push(`/dashboard/story/${uid}`);
            onClose();
          }}
          style={{ padding: '18px', cursor: 'pointer', fontWeight: 'bold', color: '#E91E63', borderBottom: '1px solid #f0f0f0' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff0f5'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          📸 Lihat Story (24 Jam)
        </div>

        {/* Tombol Tutup */}
        <div 
          onClick={onClose}
          style={{ padding: '15px', cursor: 'pointer', color: '#999', fontSize: '14px' }}
        >
          Tutup
        </div>
      </div>
    </div>
  );
}