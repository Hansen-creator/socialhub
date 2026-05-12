'use client';

import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { faArrowRight, faCircleNotch } from '@fortawesome/free-solid-svg-icons';
import Image from 'next/image';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/dashboard');
    } catch (error) {
      console.error('Gagal login dengan Google:', error);
      alert('Gagal login, silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 overflow-hidden relative font-sans">
      
      {/* Background Ornaments (Efek Cahaya Blur) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-8 md:p-12 rounded-[3rem] shadow-2xl text-center">
          
          {/* Logo Container */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
            whileHover={{ rotate: 5, scale: 1.05 }}
            className="w-24 h-24 relative mx-auto mb-8 cursor-pointer drop-shadow-[0_0_15px_rgba(37,99,235,0.3)]"
          >
            <Image 
              src="/logo.svg" 
              alt="Social Hub Logo" 
              fill 
              priority
              className="object-contain" 
            />
          </motion.div>

          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
            Social<span className="text-blue-400">Hub</span>
          </h1>
          
          <p className="text-slate-400 text-sm mb-10 leading-relaxed max-w-[280px] mx-auto">
            Platform produktivitas komunitas untuk pengembang profesional.
          </p>

          <div className="space-y-4">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleLogin} 
              disabled={isLoading}
              className="w-full group relative flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-blue-50 text-slate-900 font-bold rounded-2xl transition-all shadow-xl shadow-blue-500/5 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <FontAwesomeIcon icon={faCircleNotch} className="animate-spin text-blue-600 text-xl" />
              ) : (
                <>
                  <FontAwesomeIcon icon={faGoogle} className="text-red-500 text-xl" />
                  <span>Lanjutkan dengan Google</span>
                  <FontAwesomeIcon 
                    icon={faArrowRight} 
                    className="absolute right-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-blue-600" 
                  />
                </>
              )}
            </motion.button>
          </div>

          <p className="mt-8 text-[10px] text-slate-500 tracking-[0.2em] uppercase font-bold">
            Secure Access • Firebase Auth
          </p>
        </div>
        
        {/* Footer Info */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center text-slate-500 text-xs tracking-wide uppercase font-medium"
        >
          &copy; 2026 Social Hub. Build with precision.
        </motion.p>
      </motion.div>
    </div>
  );
}