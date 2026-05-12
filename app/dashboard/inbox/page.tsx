'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHeart, faComment, faShare, faEnvelope, faBell, 
  faTrashAlt, faCheckDouble, faClock, faCalendarAlt,
  faUserPlus, faUserCheck, faInbox
} from '@fortawesome/free-solid-svg-icons';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'share' | 'chat' | 'system' | 'friend_request' | 'friend_accepted';
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  message: string;
  relatedId: string;
  isRead: boolean;
  createdAt: any;
}

export default function Inbox() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (!u) {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, `users/${user.uid}/notifications`), 
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Notification[];
      setNotifications(data);
      setLoading(false);
    }, (error) => {
      console.error("Error loading notifications:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleAction = async (notif: Notification) => {
    if (!user) return;
    try {
      if (!notif.isRead) {
        await updateDoc(doc(db, `users/${user.uid}/notifications`, notif.id), { 
          isRead: true 
        });
      }

      if (notif.type === 'chat') {
        router.push('/dashboard/chat');
      } else if (notif.type === 'friend_request' || notif.type === 'friend_accepted') {
        router.push('/dashboard/chat');
      } else if (notif.type === 'like' || notif.type === 'comment' || notif.type === 'share') {
        router.push(`/dashboard/profile`);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error("Failed to update notification:", err);
    }
  };

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      const unreadNotifications = notifications.filter(n => !n.isRead);
      
      unreadNotifications.forEach((notif) => {
        const notifRef = doc(db, `users/${user.uid}/notifications`, notif.id);
        batch.update(notifRef, { isRead: true });
      });
      
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const clearAll = async () => {
    if (!user || notifications.length === 0) return;
    if (!confirm("Delete all notifications? This action cannot be undone.")) return;
    
    try {
      const batch = writeBatch(db);
      const snapshot = await getDocs(collection(db, `users/${user.uid}/notifications`));
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return faHeart;
      case 'comment': return faComment;
      case 'share': return faShare;
      case 'chat': return faEnvelope;
      case 'friend_request': return faUserPlus;
      case 'friend_accepted': return faUserCheck;
      default: return faBell;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'like': return '#e91e63';
      case 'comment': return '#3b82f6';
      case 'share': return '#10b981';
      case 'chat': return '#8b5cf6';
      case 'friend_request': return '#f59e0b';
      case 'friend_accepted': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getIconBgColor = (type: string) => {
    switch (type) {
      case 'like': return '#fce7f3';
      case 'comment': return '#eff6ff';
      case 'share': return '#ecfdf5';
      case 'chat': return '#f5f3ff';
      case 'friend_request': return '#fffbeb';
      case 'friend_accepted': return '#ecfdf5';
      default: return '#f3f4f6';
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp?.seconds) return '';
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const getDateString = (timestamp: any) => {
    if (!timestamp?.seconds) return '';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="inbox-page">
      <div className="inbox-container">
        {/* Header */}
        <div className="inbox-header">
          <div className="header-left">
            <div className="header-icon">
              <FontAwesomeIcon icon={faInbox} />
            </div>
            <div>
              <h1>Inbox</h1>
              <p>Track all your interactions and activities</p>
            </div>
          </div>
          
          {notifications.length > 0 && (
            <div className="header-actions">
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="btn-primary">
                  <FontAwesomeIcon icon={faCheckDouble} />
                  <span>Mark all read</span>
                  {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                </button>
              )}
              <button onClick={clearAll} className="btn-secondary">
                <FontAwesomeIcon icon={faTrashAlt} />
                <span>Clear all</span>
              </button>
            </div>
          )}
        </div>

        {/* Notifications List */}
        <div className="notifications-list">
          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h3>No notifications</h3>
              <p>We'll notify you when something arrives</p>
            </div>
          ) : (
            <>
              {unreadCount > 0 && (
                <div className="unread-badge">
                  <span className="dot" />
                  {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
                </div>
              )}
              
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  onClick={() => handleAction(notification)}
                  className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                >
                  <div className="notification-icon" style={{ backgroundColor: getIconBgColor(notification.type) }}>
                    <FontAwesomeIcon icon={getIcon(notification.type)} style={{ color: getIconColor(notification.type) }} />
                  </div>
                  
                  <div className="notification-content">
                    <p className="notification-message">
                      <strong>{notification.senderName}</strong> {notification.message}
                    </p>
                    <div className="notification-meta">
                      <span className="meta-time">
                        <FontAwesomeIcon icon={faClock} />
                        {formatTime(notification.createdAt)}
                      </span>
                      <span className="meta-date">
                        <FontAwesomeIcon icon={faCalendarAlt} />
                        {getDateString(notification.createdAt)}
                      </span>
                    </div>
                  </div>
                  
                  {!notification.isRead && <div className="unread-dot" />}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && !loading && (
          <div className="inbox-footer">
            <p>Click any notification to view details</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .inbox-page {
          min-height: 100vh;
          background: transparent;
          padding: 5rem 1.5rem 3rem;
        }

        .inbox-container {
          max-width: 720px;
          margin: 0 auto;
        }

        /* Header */
        .inbox-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .header-icon {
          width: 52px;
          height: 52px;
          background: transparent;
          border-radius: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
        }

        .header-icon svg {
          font-size: 24px;
          color: white;
        }

        .header-left h1 {
          font-size: 1.75rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 0.25rem 0;
          letter-spacing: -0.02em;
        }

        .header-left p {
          font-size: 0.875rem;
          color: #64748b;
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: 0.75rem;
        }

        .btn-primary, .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 2rem;
          font-size: 0.813rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .btn-primary:hover {
          background: #2563eb;
          transform: translateY(-1px);
        }

        .btn-secondary {
          background: white;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .btn-secondary:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .badge {
          background: rgba(255, 255, 255, 0.25);
          border-radius: 1rem;
          padding: 0.125rem 0.5rem;
          font-size: 0.688rem;
          font-weight: 600;
        }

        /* Notifications List */
        .notifications-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .unread-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: #eff6ff;
          border-radius: 2rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: #2563eb;
          width: fit-content;
          margin-bottom: 0.5rem;
        }

        .unread-badge .dot {
          width: 8px;
          height: 8px;
          background: #3b82f6;
          border-radius: 50%;
        }

        .notification-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          background: white;
          border-radius: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid #eef2f6;
          position: relative;
        }

        .notification-item:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          transform: translateX(4px);
        }

        .notification-item.unread {
          background: #fefce8;
          border-color: #fde047;
        }

        .notification-icon {
          width: 48px;
          height: 48px;
          border-radius: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .notification-icon svg {
          font-size: 1.25rem;
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-message {
          font-size: 0.875rem;
          color: #334155;
          margin: 0 0 0.5rem 0;
          line-height: 1.4;
        }

        .notification-message strong {
          color: #1e293b;
          font-weight: 600;
        }

        .notification-meta {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-size: 0.688rem;
          color: #94a3b8;
        }

        .notification-meta span {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }

        .notification-meta svg {
          font-size: 0.625rem;
        }

        .unread-dot {
          width: 10px;
          height: 10px;
          background: #3b82f6;
          border-radius: 50%;
          position: absolute;
          top: 1rem;
          right: 1rem;
          box-shadow: 0 0 0 2px white;
        }

        /* Loading & Empty States */
        .loading-state, .empty-state {
          text-align: center;
          padding: 3rem 1.5rem;
          background: white;
          border-radius: 1rem;
          border: 1px solid #eef2f6;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 1rem auto;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .empty-state h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 0.25rem 0;
        }

        .empty-state p {
          font-size: 0.813rem;
          color: #94a3b8;
          margin: 0;
        }

        .loading-state p {
          font-size: 0.813rem;
          color: #94a3b8;
          margin: 0;
        }

        /* Footer */
        .inbox-footer {
          text-align: center;
          margin-top: 1.5rem;
          padding: 1rem;
          font-size: 0.688rem;
          color: #94a3b8;
          border-top: 1px solid #eef2f6;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .inbox-page {
            padding: 4rem 1rem 2rem;
          }

          .inbox-header {
            flex-direction: column;
          }

          .header-left {
            width: 100%;
          }

          .header-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .notification-item {
            padding: 0.875rem 1rem;
          }

          .notification-icon {
            width: 40px;
            height: 40px;
          }

          .notification-icon svg {
            font-size: 1rem;
          }

          .notification-message {
            font-size: 0.813rem;
          }
        }
      `}</style>
    </div>
  );
}