'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWifi, faExclamationTriangle, faSignInAlt } from '@fortawesome/free-solid-svg-icons';

export default function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Logika untuk menangani Online/Offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCountdown(30);
    };

    const handleOffline = () => {
      setIsOffline(true);
      // Hanya jalankan setInterval untuk mengurangi angka
      timerRef.current = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 2. Logika Terpisah untuk Navigasi (Mencegah Error setState-in-render)
  useEffect(() => {
    if (isOffline && countdown === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      router.push('/login');
    }
  }, [isOffline, countdown, router]);

  if (!isOffline) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center p-4 bg-black/40 backdrop-blur-sm transition-all text-slate-900">
      <div className="bg-white rounded-2xl shadow-2xl border-b-4 border-red-500 p-6 max-w-sm w-full animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <FontAwesomeIcon icon={faWifi} className="text-red-500 text-2xl animate-pulse" />
          </div>
          
          <div>
            <h3 className="font-bold text-lg">Koneksi Terputus</h3>
            <p className="text-gray-500 text-sm mt-1">
              Sinyal bermasalah. Sesi Anda akan berakhir demi keamanan.
            </p>
          </div>

          <div className="w-full bg-gray-100 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-600 font-medium text-sm">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              <span>Sesi Berakhir:</span>
            </div>
            <span className="bg-red-500 text-white px-3 py-1 rounded-lg font-mono font-bold">
              {countdown}s
            </span>
          </div>

          <button 
            onClick={() => router.push('/login')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-100"
          >
            <FontAwesomeIcon icon={faSignInAlt} />
            Login Ulang Sekarang
          </button>
        </div>
      </div>
    </div>
  );
}