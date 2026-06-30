'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { 
  collection, query, where, getDocs, orderBy, 
  Timestamp, doc, updateDoc, addDoc, serverTimestamp, setDoc,
  getDoc, increment, arrayUnion, arrayRemove
} from 'firebase/firestore';

interface Viewer {
  uid: string;
  userName: string;
  viewedAt: string;
}

interface Like {
  uid: string;
  userName: string;
  likedAt: string;
}

interface Story {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  imageUrl: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  viewers: Viewer[];
  likes: Like[];
  likeCount: number;
}

export default function StoryViewerClient() {
  const { id } = useParams();
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reply, setReply] = useState('');
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [uploadTime, setUploadTime] = useState<string>('');
  const [showViewers, setShowViewers] = useState(false);
  const [sending, setSending] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showLikes, setShowLikes] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatUploadTime = (createdAt: Timestamp) => {
    const now = new Date();
    const uploadDate = createdAt.toDate();
    const diffMs = now.getTime() - uploadDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    return `${diffDays} hari lalu`;
  };

  const navigateToDashboard = useCallback(() => {
    if (timeoutRef.current) return;
    timeoutRef.current = setTimeout(() => {
      router.push('/dashboard');
      timeoutRef.current = null;
    }, 100);
  }, [router]);

  const handleNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      navigateToDashboard();
    }
  }, [currentIndex, stories.length, navigateToDashboard]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    } else {
      navigateToDashboard();
    }
  }, [currentIndex, navigateToDashboard]);

  useEffect(() => {
    const fetchStories = async () => {
      if (!id) return;
      
      try {
        const now = Timestamp.now();
        const q = query(
          collection(db, 'stories'),
          where('userId', '==', id),
          where('expiresAt', '>', now),
          orderBy('createdAt', 'asc')
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
          const fetchedStories = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            likes: doc.data().likes || [],
            likeCount: doc.data().likeCount || 0
          })) as Story[];
          setStories(fetchedStories);
        } else {
          navigateToDashboard();
        }
      } catch (err) {
        console.error("Fetch Error:", err);
        navigateToDashboard();
      } finally {
        setLoading(false);
      }
    };
    
    fetchStories();
  }, [id, navigateToDashboard]);

  useEffect(() => {
    if (stories[currentIndex]) {
      const currentStory = stories[currentIndex];
      setViewerCount(currentStory.viewers?.length || 0);
      setUploadTime(formatUploadTime(currentStory.createdAt));
      setLikeCount(currentStory.likeCount || 0);
      
      const currentUid = auth.currentUser?.uid;
      if (currentUid) {
        const hasLiked = currentStory.likes?.some((like: Like) => like.uid === currentUid);
        setLiked(hasLiked || false);
      }
    }
  }, [currentIndex, stories]);

  useEffect(() => {
    const markAsViewed = async () => {
      const currentUid = auth.currentUser?.uid;
      const currentStory = stories[currentIndex];

      if (!currentUid || !currentStory) return;
      if (currentUid === id) return;

      const alreadyViewed = currentStory.viewers?.some((v: Viewer) => v.uid === currentUid);
      if (!alreadyViewed) {
        const storyRef = doc(db, 'stories', currentStory.id);
        const newViewer: Viewer = {
          uid: currentUid,
          userName: auth.currentUser?.displayName || 'User',
          viewedAt: new Date().toISOString()
        };

        await updateDoc(storyRef, {
          viewers: arrayUnion(newViewer)
        });
        
        const updatedStories = [...stories];
        updatedStories[currentIndex] = {
          ...updatedStories[currentIndex],
          viewers: [...(updatedStories[currentIndex].viewers || []), newViewer]
        };
        setStories(updatedStories);
        setViewerCount(prev => prev + 1);
      }
    };
    
    markAsViewed();
  }, [currentIndex, stories, id]);

  useEffect(() => {
    if (!stories.length || isPaused) {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      return;
    }

    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (progressInterval.current) {
            clearInterval(progressInterval.current);
            progressInterval.current = null;
          }
          handleNext();
          return 0;
        }
        return prev + 2;
      });
    }, 100);

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    };
  }, [currentIndex, stories.length, isPaused, handleNext]);

  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  const handleLike = async () => {
    const currentUid = auth.currentUser?.uid;
    const currentStory = stories[currentIndex];
    
    if (!currentUid || !currentStory || currentUid === id) return;
    
    const storyRef = doc(db, 'stories', currentStory.id);
    const newLike: Like = {
      uid: currentUid,
      userName: auth.currentUser?.displayName || 'User',
      likedAt: new Date().toISOString()
    };
    
    if (!liked) {
      await updateDoc(storyRef, {
        likes: arrayUnion(newLike),
        likeCount: increment(1)
      });
      
      const updatedStories = [...stories];
      updatedStories[currentIndex] = {
        ...updatedStories[currentIndex],
        likes: [...(updatedStories[currentIndex].likes || []), newLike],
        likeCount: (updatedStories[currentIndex].likeCount || 0) + 1
      };
      setStories(updatedStories);
      setLiked(true);
      setLikeCount(prev => prev + 1);
    } else {
      await updateDoc(storyRef, {
        likes: arrayRemove(newLike),
        likeCount: increment(-1)
      });
      
      const updatedStories = [...stories];
      updatedStories[currentIndex] = {
        ...updatedStories[currentIndex],
        likes: updatedStories[currentIndex].likes?.filter((like: Like) => like.uid !== currentUid) || [],
        likeCount: (updatedStories[currentIndex].likeCount || 0) - 1
      };
      setStories(updatedStories);
      setLiked(false);
      setLikeCount(prev => prev - 1);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentUid = auth.currentUser?.uid;
    if (!reply.trim() || !currentUid || sending || currentUid === id) return;

    setSending(true);
    try {
      const participants = [currentUid, id as string].sort();
      const chatId = participants.join('_');
      const currentMedia = stories[currentIndex].imageUrl;
      const storyUserName = stories[currentIndex].userName;

      await setDoc(doc(db, 'chats', chatId), {
        participants,
        updatedAt: serverTimestamp(),
        lastMessage: `Membalas Story: ${reply.substring(0, 50)}${reply.length > 50 ? '...' : ''}`,
        lastMessageSender: currentUid,
        unreadCount: {
          [currentUid]: 0,
          [id as string]: (await getDoc(doc(db, 'chats', chatId))).data()?.unreadCount?.[id as string] + 1 || 1
        }
      }, { merge: true });

      await addDoc(collection(db, `chats/${chatId}/messages`), {
        text: reply,
        senderId: currentUid,
        readBy: [currentUid],
        createdAt: serverTimestamp(),
        isStoryReply: true,
        storyUrl: currentMedia,
        storyOwner: storyUserName,
        storyOwnerId: id
      });

      setReplySuccess(true);
      setTimeout(() => setReplySuccess(false), 3000);
      setReply('');
      setIsPaused(false);
    } catch (err) {
      console.error("Reply Error:", err);
      alert("Gagal mengirim balasan. Silakan coba lagi.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const ViewersModal = () => {
    if (!showViewers) return null;
    const viewers = stories[currentIndex]?.viewers || [];
    
    return (
      <div className="modal-overlay" onClick={() => setShowViewers(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            {/* Diubah ke h2 demi struktur Readability yang benar */}
            <h2>Penonton ({viewers.length})</h2>
            <button onClick={() => setShowViewers(false)} className="modal-close">×</button>
          </div>
          <div className="modal-list">
            {viewers.length === 0 ? (
              <p className="empty-text">Belum ada yang menonton</p>
            ) : (
              viewers.map((viewer, idx) => (
                <div key={idx} className="modal-item">
                  <div className="avatar">
                    {viewer.userName?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="item-name">{viewer.userName}</div>
                    <div className="item-time">{new Date(viewer.viewedAt).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const LikesModal = () => {
    if (!showLikes) return null;
    const likes = stories[currentIndex]?.likes || [];
    
    return (
      <div className="modal-overlay" onClick={() => setShowLikes(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            {/* Diubah ke h2 demi struktur Readability yang benar */}
            <h2>Like ({likes.length})</h2>
            <button onClick={() => setShowLikes(false)} className="modal-close">×</button>
          </div>
          <div className="modal-list">
            {likes.length === 0 ? (
              <p className="empty-text">Belum ada yang like</p>
            ) : (
              likes.map((like, idx) => (
                <div key={idx} className="modal-item">
                  <div className="avatar">
                    {like.userName?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="item-name">{like.userName}</div>
                    <div className="item-time">{new Date(like.likedAt).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="loading-screen" />;
  if (!stories.length) return null;

  const currentStory = stories[currentIndex];
  const isOwnStory = auth.currentUser?.uid === id;

  return (
    <div className="story-viewer-container">
      <div className="top-overlay">
        <div className="progress-bars">
          {stories.map((_, index) => (
            <div key={index} className="progress-bar-track">
              <div 
                className="progress-bar-fill"
                style={{ 
                  width: index === currentIndex ? `${progress}%` : index < currentIndex ? '100%' : '0%'
                }}
              />
            </div>
          ))}
        </div>

        <div className="user-info">
          <div className="user-details" onClick={() => router.push(`/profile/${id}`)}>
            <div 
              className="user-avatar"
              style={{ 
                background: currentStory.userPhotoURL ? `url(${currentStory.userPhotoURL}) center/cover` : '#4285F4'
              }}
            >
              {!currentStory.userPhotoURL && (currentStory.userName?.charAt(0).toUpperCase() || '?')}
            </div>
            <div>
              <div className="user-name">{currentStory.userName}</div>
              <div className="story-meta">
                {uploadTime} • {viewerCount} tontonan
              </div>
            </div>
          </div>
          <div className="action-buttons">
            {!isOwnStory && likeCount > 0 && (
              <button onClick={() => setShowLikes(true)} className="icon-button">
                ❤️ {likeCount}
              </button>
            )}
            {!isOwnStory && viewerCount > 0 && (
              <button onClick={() => setShowViewers(true)} className="icon-button">
                👁️ {viewerCount}
              </button>
            )}
            <button onClick={navigateToDashboard} className="close-button">×</button>
          </div>
        </div>
      </div>

      <div className="navigation-area">
        <div className="nav-left" onClick={handlePrev} />
        <div className="nav-center" onClick={() => setIsPaused(!isPaused)} />
        <div className="nav-right" onClick={handleNext} />
      </div>

      <div className="media-content">
        {currentStory.imageUrl?.match(/\.(mp4|webm|ogg)$/i) ? (
          <video
            ref={videoRef}
            src={currentStory.imageUrl}
            autoPlay
            loop
            muted
            playsInline
            className="media-video"
            onPlay={() => setIsPaused(false)}
            onPause={() => setIsPaused(true)}
          />
        ) : (
          /* Ditambahkan alt yang representatif untuk meningkatkan Accessibility & SEO */
          <img 
            src={currentStory.imageUrl} 
            alt={`Story milik ${currentStory.userName}`} 
            className="media-image"
          />
        )}
        
        {isPaused && (
          <div className="pause-indicator">
            <span>⏸</span>
          </div>
        )}

        {!isOwnStory && (
          <button onClick={handleLike} className={`floating-like ${liked ? 'liked' : ''}`}>
            {liked ? '❤️' : '🤍'}
          </button>
        )}
      </div>

      {!isOwnStory && (
        <form onSubmit={handleReply} className="reply-form">
          <div className="reply-input-container">
            <input 
              type="text" 
              placeholder="Kirim pesan..." 
              value={reply}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
              onChange={(e) => setReply(e.target.value)}
              disabled={sending}
              className="reply-input"
            />
            <button 
              type="submit" 
              disabled={!reply.trim() || sending}
              className="reply-submit"
            >
              {sending ? '...' : 'Kirim'}
            </button>
          </div>
          {replySuccess && (
            <div className="reply-success">
              ✓ Balasan terkirim!
            </div>
          )}
        </form>
      )}

      {isOwnStory && (
        <div className="story-footer">
          <div className="footer-text">
            ❤️ {likeCount} likes • 👁️ {viewerCount} tontonan • Diupload {uploadTime}
          </div>
        </div>
      )}

      <ViewersModal />
      <LikesModal />

      <style jsx>{`
        .story-viewer-container {
          height: 100dvh;
          width: 100vw;
          background-color: #000;
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
        }
        .top-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 20;
          padding: 15px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%);
        }
        .progress-bars {
          display: flex;
          gap: 4px;
          margin-bottom: 12px;
        }
        .progress-bar-track {
          flex: 1;
          height: 2px;
          background-color: rgba(255,255,255,0.3);
          border-radius: 10px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background-color: #fff;
          transition: width 0.1s linear;
        }
        .user-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .user-details {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }
        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          justify-content: center;
          align-items: center;
          color: #fff;
          font-weight: bold;
          border: 1px solid #fff;
        }
        .user-name {
          color: #fff;
          font-weight: 600;
          font-size: 14px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        }
        .story-meta {
          color: rgba(255,255,255,0.7);
          font-size: 11px;
        }
        .action-buttons {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .icon-button {
          background: rgba(0,0,0,0.5);
          border: none;
          color: #fff;
          font-size: 12px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 20px;
        }
        .close-button {
          background: none;
          border: none;
          color: #fff;
          font-size: 28px;
          cursor: pointer;
          line-height: 1;
        }
        .navigation-area {
          position: absolute;
          inset: 0;
          display: flex;
          z-index: 5;
        }
        .nav-left { flex: 1; }
        .nav-center { flex: 2; }
        .nav-right { flex: 1; }
        .media-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .media-video, .media-image {
          width: 100%;
          max-height: 100vh;
          object-fit: contain;
        }
        .pause-indicator {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: rgba(0,0,0,0.7);
          border-radius: 50%;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          font-size: 24px;
          color: #fff;
        }
        .floating-like {
          position: absolute;
          bottom: 100px;
          right: 20px;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(0,0,0,0.6);
          border: none;
          font-size: 28px;
          cursor: pointer;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          z-index: 15;
        }
        .floating-like.liked {
          animation: likeAnimation 0.3s ease;
        }
        @keyframes likeAnimation {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .reply-form {
          padding: 20px 15px 40px;
          background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%);
          position: relative;
          z-index: 10;
        }
        .reply-input-container {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .reply-input {
          flex: 1;
          padding: 12px 20px;
          border-radius: 30px;
          border: 1px solid rgba(255,255,255,0.4);
          background: rgba(255,255,255,0.1);
          color: #fff;
          outline: none;
          backdrop-filter: blur(10px);
          font-size: 14px;
        }
        .reply-input::placeholder { color: rgba(255,255,255,0.6); }
        .reply-input:disabled { opacity: 0.6; }
        .reply-submit {
          background: #4285F4;
          color: #fff;
          border: none;
          padding: 0 20px;
          border-radius: 30px;
          font-weight: bold;
          height: 44px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .reply-submit:disabled {
          background: #666;
          cursor: not-allowed;
        }
        .reply-success {
          position: absolute;
          bottom: 90px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #4CAF50;
          color: #fff;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          white-space: nowrap;
          animation: fadeInUp 0.3s ease;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .story-footer {
          position: absolute;
          bottom: 20px;
          left: 0;
          right: 0;
          text-align: center;
          z-index: 10;
          padding: 10px;
          background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%);
        }
        .footer-text { color: rgba(255,255,255,0.8); font-size: 12px; }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(0,0,0,0.9);
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .modal-content {
          background-color: #1a1a1a;
          border-radius: 20px;
          max-width: 400px;
          width: 100%;
          max-height: 80vh;
          overflow: auto;
          padding: 20px;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .modal-header h2 { color: #fff; margin: 0; }
        .modal-close {
          background: none;
          border: none;
          color: #fff;
          font-size: 24px;
          cursor: pointer;
        }
        .modal-list { display: flex; flex-direction: column; gap: 12px; }
        .modal-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px;
          background-color: #2a2a2a;
          border-radius: 12px;
        }
        .avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: #4285F4;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: bold;
        }
        .item-name { color: #fff; font-weight: 500; }
        .item-time { color: #888; font-size: 12px; }
        .empty-text { color: #888; text-align: center; }
        .loading-screen { height: 100vh; background: #000; }

        @media (min-width: 768px) {
          .top-overlay { padding: 20px 30px; }
          .user-avatar { width: 44px; height: 44px; }
          .user-name { font-size: 16px; }
          .story-meta { font-size: 13px; }
          .reply-form { padding: 20px 30px 40px; }
          .reply-input { padding: 14px 24px; font-size: 16px; }
          .reply-submit { height: 50px; padding: 0 24px; }
          .floating-like { bottom: 120px; right: 30px; width: 60px; height: 60px; font-size: 32px; }
        }
        @media (min-width: 1024px) {
          .top-overlay { padding: 25px 40px; }
          .user-avatar { width: 48px; height: 48px; }
          .user-name { font-size: 18px; }
          .story-meta { font-size: 14px; }
          .reply-form { padding: 20px 40px 40px; }
          .reply-input { padding: 16px 28px; font-size: 16px; }
          .reply-submit { height: 54px; padding: 0 28px; font-size: 16px; }
          .floating-like { bottom: 140px; right: 40px; width: 70px; height: 70px; font-size: 36px; }
          .modal-content { max-width: 500px; }
        }
        @media (hover: hover) {
          .icon-button:hover, .reply-submit:hover, .floating-like:hover { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
