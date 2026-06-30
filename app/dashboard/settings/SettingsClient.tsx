'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth'; // Mengganti 'any' dengan tipe data bawaan Firebase
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowLeft, faInfoCircle, faFileAlt, 
  faCheckCircle, faTimesCircle, faUserShield, faClock, 
  faCodeBranch, faLock, faSignOutAlt
} from '@fortawesome/free-solid-svg-icons';

export default function SettingsClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLicense, setShowLicense] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const SYSTEM_INFO = {
    version: "3.6.0",
    buildDate: "May 2026",
    licenseType: "MIT License",
    developer: "Social Hub",
    apiVersion: "v2.1.0",
    lastUpdate: "May 3, 2026"
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error("Logout error:", err);
      alert("Failed to logout. Please try again.");
    }
    setShowLogoutConfirm(false);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" aria-label="Loading" />
        <p>Loading settings...</p>
        <style jsx>{`
          .loading-screen {
            position: fixed;
            inset: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background: #f8fafc;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #e2e8f0;
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 1rem;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          p { color: #64748b; font-size: 0.875rem; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        {/* Header */}
        <div className="settings-header">
          {/* Ditambahkan aria-label dan icon agar button yang tidak memiliki teks tetap readable oleh bot */}
          <button onClick={() => router.back()} className="back-btn" aria-label="Kembali ke halaman sebelumnya">
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div className="header-title">
            <h1>Settings</h1>
            <p>Manage your account and preferences</p>
          </div>
        </div>

        {/* Account Section */}
        <section className="settings-card">
          <div className="card-header">
            <div className="card-icon blue">
              <FontAwesomeIcon icon={faUserShield} />
            </div>
            <h2>Account Information</h2>
          </div>
          <div className="info-row">
            <span className="info-label">Email Address</span>
            <span className="info-value">{user?.email || 'Not set'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">User ID</span>
            <span className="info-value">{user?.uid ? `${user.uid.substring(0, 16)}...` : 'Not set'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Account Status</span>
            <span className="info-value active">Active</span>
          </div>
        </section>

        {/* App Info Section */}
        <section className="settings-card">
          <div className="card-header">
            <div className="card-icon green">
              <FontAwesomeIcon icon={faInfoCircle} />
            </div>
            <h2>Application Info</h2>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <span className="item-label">Version</span>
              <span className="item-value">
                <FontAwesomeIcon icon={faCodeBranch} />
                {SYSTEM_INFO.version}
              </span>
            </div>
            <div className="info-item">
              <span className="item-label">License</span>
              <span className="item-value">{SYSTEM_INFO.licenseType}</span>
            </div>
            <div className="info-item">
              <span className="item-label">API Version</span>
              <span className="item-value">{SYSTEM_INFO.apiVersion}</span>
            </div>
            <div className="info-item">
              <span className="item-label">Last Update</span>
              <span className="item-value">
                <FontAwesomeIcon icon={faClock} />
                {SYSTEM_INFO.lastUpdate}
              </span>
            </div>
            <div className="info-item">
              <span className="item-label">Build Date</span>
              <span className="item-value">{SYSTEM_INFO.buildDate}</span>
            </div>
            <div className="info-item">
              <span className="item-label">Developer</span>
              <span className="item-value">{SYSTEM_INFO.developer}</span>
            </div>
          </div>
        </section>

        {/* Legal Section */}
        <section className="settings-card">
          <div className="card-header">
            <div className="card-icon orange">
              <FontAwesomeIcon icon={faFileAlt} />
            </div>
            <h2>Legal & Terms</h2>
          </div>
          <p className="legal-text">
            By using Social Hub, you agree to our terms of service. 
            We are committed to protecting your privacy and data security.
          </p>
          <button onClick={() => setShowLicense(true)} className="license-btn">
            <FontAwesomeIcon icon={faFileAlt} />
            Read License Agreement
          </button>
        </section>

        {/* Logout Section */}
        <section className="settings-card logout-card">
          <div className="card-header">
            <div className="card-icon red">
              <FontAwesomeIcon icon={faLock} />
            </div>
            <h2>Session Management</h2>
          </div>
          <button onClick={() => setShowLogoutConfirm(true)} className="logout-btn">
            <FontAwesomeIcon icon={faSignOutAlt} />
            Sign Out
          </button>
        </section>

        {/* Footer */}
        <footer className="settings-footer">
          <p>© 2026 Social Hub. All rights reserved.</p>
        </footer>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">
              <FontAwesomeIcon icon={faSignOutAlt} />
            </div>
            <h2>Sign Out</h2>
            <p>Are you sure you want to sign out of your account?</p>
            <div className="modal-actions">
              <button onClick={() => setShowLogoutConfirm(false)} className="modal-cancel">
                Cancel
              </button>
              <button onClick={handleLogout} className="modal-confirm">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* License Modal */}
      {showLicense && (
        <div className="modal-overlay" onClick={() => setShowLicense(false)}>
          <div className="license-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon blue">
                <FontAwesomeIcon icon={faFileAlt} />
              </div>
              <h2>License Agreement</h2>
              <button onClick={() => setShowLicense(false)} className="modal-close" aria-label="Tutup modal lisensi">
                <FontAwesomeIcon icon={faTimesCircle} />
              </button>
            </div>
            <div className="license-content">
              {/* Mengubah h4 menjadi h3 agar tidak melompati aturan hierarki heading dokumen */}
              <div className="license-summary">
                <h3>MIT License Summary</h3>
                <p>This application uses the MIT License, which permits use, modification, and distribution with certain conditions.</p>
              </div>
              
              <div className="license-section">
                <h3>1. Service Usage</h3>
                <p>This application is provided for communication and social productivity purposes. Users are prohibited from distributing illegal, harmful, or content that violates applicable laws.</p>
              </div>
              
              <div className="license-section">
                <h3>2. Data Ownership</h3>
                <p>All chat data, posts, and other content belong to the users, but the system reserves the right to store encrypted data on cloud servers while the account is active. Data is permanently deleted after account deletion.</p>
              </div>
              
              <div className="license-section">
                <h3>3. Privacy & Security</h3>
                <p>We are committed to protecting your personal data. Information such as email, name, and profile photo is only used for service purposes and will not be shared with third parties without consent.</p>
              </div>
              
              <div className="license-section">
                <h3>4. Limitation of Liability</h3>
                <p>The developer is not responsible for data loss due to user negligence, technical issues, or third-party attacks. Users are advised to regularly back up important data.</p>
              </div>
              
              <div className="license-section">
                <h3>5. System Updates</h3>
                <p>Version {SYSTEM_INFO.version} includes real-time chat module performance improvements, security enhancements, and user interface updates.</p>
              </div>
              
              <div className="license-update">
                By continuing to use this application, you agree to all terms above.
                Last updated: {SYSTEM_INFO.lastUpdate}
              </div>
            </div>
            <button onClick={() => setShowLicense(false)} className="agree-btn">
              <FontAwesomeIcon icon={faCheckCircle} />
              I Understand & Agree
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .settings-page { min-height: 100vh; background: #f7f9fc; padding: 5rem 1rem 3rem; }
        .settings-container { max-width: 800px; margin: 0 auto; }
        .settings-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; }
        .back-btn { background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: #475569; cursor: pointer; transition: all 0.2s; }
        .back-btn:hover { background: #f1f5f9; color: #1e293b; }
        .header-title h1 { font-size: 1.75rem; font-weight: 600; color: #1e293b; margin: 0 0 0.25rem 0; letter-spacing: -0.02em; }
        .header-title p { font-size: 0.875rem; color: #64748b; margin: 0; }
        .settings-card { background: white; border-radius: 1rem; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid #eef2f6; transition: all 0.2s; }
        .card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f0f2f5; }
        .card-icon { width: 36px; height: 36px; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center; }
        .card-icon.blue { background: #eff6ff; color: #3b82f6; }
        .card-icon.green { background: #ecfdf5; color: #10b981; }
        .card-icon.orange { background: #fffbeb; color: #f59e0b; }
        .card-icon.red { background: #fef2f2; color: #ef4444; }
        .card-header h2 { font-size: 1rem; font-weight: 600; color: #1e293b; margin: 0; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #f8fafc; }
        .info-row:last-child { border-bottom: none; }
        .info-label { font-size: 0.813rem; color: #64748b; }
        .info-value { font-size: 0.813rem; font-weight: 500; color: #1e293b; }
        .info-value.active { color: #10b981; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
        .info-item { display: flex; flex-direction: column; gap: 0.25rem; }
        .item-label { font-size: 0.688rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .item-value { font-size: 0.875rem; font-weight: 500; color: #1e293b; display: inline-flex; align-items: center; gap: 0.375rem; }
        .item-value svg { font-size: 0.75rem; color: #3b82f6; }
        .legal-text { font-size: 0.813rem; color: #475569; line-height: 1.5; margin: 0 0 1rem 0; }
        .license-btn { width: 100%; padding: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; font-size: 0.813rem; font-weight: 500; color: #3b82f6; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; }
        .license-btn:hover { background: #eff6ff; border-color: #3b82f6; }
        .logout-card { background: #fff8f5; border-color: #fed7aa; }
        .logout-btn { width: 100%; padding: 0.75rem; background: #ef4444; border: none; border-radius: 0.75rem; font-size: 0.875rem; font-weight: 500; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; }
        .logout-btn:hover { background: #dc2626; }
        .settings-footer { text-align: center; padding: 1.5rem; font-size: 0.688rem; color: #94a3b8; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal-content { background: white; border-radius: 1.25rem; padding: 1.5rem; width: 100%; max-width: 360px; text-align: center; }
        .modal-icon { width: 56px; height: 56px; background: #fef2f2; border-radius: 2rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; color: #ef4444; font-size: 1.5rem; }
        .modal-content h2 { font-size: 1.125rem; font-weight: 600; color: #1e293b; margin: 0 0 0.5rem 0; }
        .modal-content p { font-size: 0.813rem; color: #64748b; margin: 0 0 1.5rem 0; }
        .modal-actions { display: flex; gap: 0.75rem; }
        .modal-cancel, .modal-confirm { flex: 1; padding: 0.625rem; border-radius: 0.5rem; font-size: 0.813rem; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .modal-cancel { background: #f1f5f9; border: none; color: #475569; }
        .modal-cancel:hover { background: #e2e8f0; }
        .modal-confirm { background: #ef4444; border: none; color: white; }
        .modal-confirm:hover { background: #dc2626; }
        .license-modal { background: white; border-radius: 1.5rem; width: 100%; max-width: 560px; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; }
        .modal-header { display: flex; align-items: center; gap: 0.75rem; padding: 1.25rem 1.5rem; border-bottom: 1px solid #eef2f6; position: relative; }
        .modal-header h2 { font-size: 1.25rem; font-weight: 600; color: #1e293b; margin: 0; flex: 1; }
        .modal-close { background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 1.25rem; }
        .license-content { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; font-size: 0.813rem; color: #334155; line-height: 1.6; }
        .license-summary { background: #eff6ff; padding: 1rem; border-radius: 0.75rem; margin-bottom: 1rem; }
        .license-summary h3 { font-size: 0.875rem; font-weight: 600; color: #3b82f6; margin: 0 0 0.5rem 0; }
        .license-summary p { margin: 0; font-size: 0.75rem; }
        .license-section { margin-bottom: 1rem; }
        .license-section h3 { font-size: 0.813rem; font-weight: 600; color: #1e293b; margin: 0 0 0.25rem 0; }
        .license-section p { margin: 0; font-size: 0.75rem; color: #64748b; }
        .license-update { margin-top: 1rem; padding: 0.75rem; background: #f8fafc; border-radius: 0.75rem; font-size: 0.688rem; font-style: italic; color: #94a3b8; text-align: center; }
        .agree-btn { margin: 1rem 1.5rem 1.5rem; padding: 0.75rem; background: #3b82f6; border: none; border-radius: 0.75rem; font-size: 0.875rem; font-weight: 500; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; }
        .agree-btn:hover { background: #2563eb; }

        @media (max-width: 640px) {
          .settings-page { padding: 4rem 0.75rem 2rem; }
          .header-title h1 { font-size: 1.5rem; }
          .settings-card { padding: 1.25rem; }
          .info-grid { grid-template-columns: 1fr; gap: 0.75rem; }
          .modal-header h2 { font-size: 1.125rem; }
          .license-modal { max-height: 90vh; }
        }
      `}</style>
    </div>
  );
}
