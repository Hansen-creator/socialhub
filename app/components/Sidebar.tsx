'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { 
  LayoutDashboard, 
  PlusCircle, 
  ClipboardList, 
  MessageCircle, 
  Inbox, 
  User, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Wifi,
  WifiOff
} from 'lucide-react';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const APP_VERSION = "3.6.0-stable";

  // Monitoring Status Sinyal/Jaringan
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/notifications`),
      where('isRead', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snap) => setUnreadCount(snap.size));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Menggunakan replace agar history dibersihkan dan tidak bisa "Go Back"
      router.replace('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Upload', path: '/dashboard/upload', icon: PlusCircle },
    { name: 'Todo List', path: '/dashboard/todo', icon: ClipboardList },
    { name: 'Chat', path: '/dashboard/chat', icon: MessageCircle },
    { name: 'Inbox', path: '/dashboard/inbox', icon: Inbox, showBadge: true },
    { name: 'Profile', path: '/dashboard/profile', icon: User },
    { name: 'Settings', path: '/dashboard/settings', icon: Settings },
  ];

  const getIsActive = (path: string) => 
    pathname === path || (path !== '/dashboard' && pathname.startsWith(path));

  return (
    <>
      <nav className={`
        fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${scrolled 
          ? 'bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100' 
          : 'bg-white border-b border-gray-50'
        }
      `}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* LOGO */}
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-blue-200 shadow-lg transition-transform group-hover:scale-105">
                S
              </div>
              <span className="font-bold text-gray-900 tracking-tight text-lg hidden sm:inline">SOCIAL HUB</span>
            </Link>

            {/* DESKTOP MENU */}
            <div className="hidden md:flex items-center gap-1">
              {/* Signal Indicator Desktop */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full mr-2 border ${isOnline ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                <span className="text-[11px] font-bold uppercase tracking-wider">{isOnline ? 'Online' : 'Offline'}</span>
              </div>

              {menuItems.map((item) => {
                const isActive = getIsActive(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`
                      relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
                      ${isActive 
                        ? 'bg-blue-50 text-blue-600' 
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                    <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>
                      {item.name}
                    </span>
                    {item.showBadge && unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center ring-2 ring-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
              
              <div className="h-6 w-[1px] bg-gray-200 mx-2" />

              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Keluar"
              >
                <LogOut size={20} />
              </button>
            </div>

            {/* MOBILE TOGGLE */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </nav>

      {/* MOBILE DRAWER */}
      <div className={`fixed inset-0 z-[60] transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
        
        <div className={`
          absolute top-0 right-0 bottom-0 w-[300px] bg-white shadow-2xl transition-transform duration-300 ease-in-out flex flex-col
          ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}>
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-5 border-b">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                  {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                </div>
                {/* Status Dot */}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-900 leading-none">{user?.displayName || 'Pengguna'}</span>
                <span className="text-[11px] text-gray-500 mt-1 truncate max-w-[150px]">{user?.email}</span>
              </div>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
              <X size={20} />
            </button>
          </div>

          {/* Drawer Links */}
          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {menuItems.map((item) => {
              const isActive = getIsActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200
                    ${isActive ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}
                  `}
                >
                  <div className="flex items-center gap-4">
                    <Icon size={20} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                    <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>{item.name}</span>
                  </div>
                  {item.showBadge && unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t space-y-4">
            {/* Network Signal Info */}
            <div className={`flex items-center justify-between p-3 rounded-xl border ${isOnline ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
              <div className="flex items-center gap-2">
                {isOnline ? <Wifi size={16} className="text-green-600" /> : <WifiOff size={16} className="text-red-600" />}
                <span className="text-xs font-semibold text-gray-700">Status Perangkat</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isOnline ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                {isOnline ? 'Terhubung' : 'Terputus'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-colors font-semibold text-sm shadow-lg"
            >
              <LogOut size={18} />
              Keluar Sesi
            </button>
            <p className="text-center text-[10px] text-gray-400 font-medium tracking-widest uppercase">
              v{APP_VERSION}
            </p>
          </div>
        </div>
      </div>

      <div className="h-16" />
    </>
  );
}