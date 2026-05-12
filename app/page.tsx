'use client';

import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { faArrowRight, faCircleNotch } from '@fortawesome/free-solid-svg-icons';
import Image from 'next/image';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const router = useRouter();

  // Efek durasi Splash Screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500); // Tampilkan selama 2.5 detik
    return () => clearTimeout(timer);
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/dashboard');
    } catch (error) {
      console.error('Gagal login dengan Google:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] overflow-hidden relative font-sans">
      <AnimatePresence mode="wait">
        {showSplash ? (
          /* --- TAMPILAN SPLASH SCREEN --- */
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0f172a]"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                type: "spring", 
                stiffness: 260, 
                damping: 20,
                duration: 0.8 
              }}
              className="relative w-24 h-24 mb-6"
            >
              {/* Logo S Biru dari public/logo.svg */}
              <Image 
                src="/logo.svg" 
                alt="Social Hub Logo" 
                fill 
                className="object-contain drop-shadow-[0_0_20px_rgba(37,99,235,0.5)]"
              />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center"
            >
              <h2 className="text-white text-2xl font-bold tracking-widest uppercase">
                Social<span className="text-blue-500">Hub</span>
              </h2>
              {/* Loading Bar Animasi */}
              <div className="w-32 h-1 bg-white/10 rounded-full mt-4 overflow-hidden mx-auto">
                <motion.div 
                  initial={{ x: "-100%" }}
                  animate={{ x: "0%" }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  className="w-full h-full bg-blue-500"
                />
              </div>
            </motion.div>
          </motion.div>
        ) : (
          /* --- TAMPILAN HALAMAN LOGIN --- */
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen flex items-center justify-center p-4 relative"
          >
            {/* Background Ornaments */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]" />
              <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[120px]" />
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 w-full max-w-md"
            >
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-8 md:p-12 rounded-[3rem] shadow-2xl text-center">
                
                {/* Logo Link Ke Dashboard */}
                <motion.div 
                  whileHover={{ rotate: 5, scale: 1.05 }}
                  className="w-20 h-20 relative mx-auto mb-8 cursor-pointer"
                >
                   <Image src="/logo.svg" alt="Logo" fill className="object-contain" />
                </motion.div>

                <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
                  Social<span className="text-blue-400">Hub</span>
                </h1>
                <p className="text-slate-400 text-sm mb-10 leading-relaxed">
                  Platform produktivitas komunitas untuk pengembang profesional.
                </p>

                <div className="space-y-4">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGoogleLogin} 
                    disabled={isLoading}
                    className="w-full group relative flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-blue-50 text-slate-900 font-bold rounded-2xl transition-all shadow-xl disabled:opacity-70"
                  >
                    {isLoading ? (
                      <FontAwesomeIcon icon={faCircleNotch} className="animate-spin text-blue-600 text-xl" />
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faGoogle} className="text-red-500 text-xl" />
                        <span>Lanjutkan dengan Google</span>
                        <FontAwesomeIcon icon={faArrowRight} className="absolute right-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
              
              <p className="mt-8 text-center text-slate-500 text-xs tracking-wide uppercase font-medium">
                &copy; 2026 Social Hub. Build with precision.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}