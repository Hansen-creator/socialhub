'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { 
  collection, query, where, orderBy, onSnapshot, 
  doc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, Timestamp, limit, getDocs, deleteDoc 
} from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHeart, faComment, faShare, faCopy, faEnvelope, faEllipsisH,
  faReply, faChevronRight, faTrashAlt, faPaperPlane, faTimes,
  faThLarge, faRetweet, faPlay, faCalendarAlt, faCheckCircle,
  faTimesCircle, faInfoCircle, faSpinner, faEye
} from '@fortawesome/free-solid-svg-icons';

// Custom Alert Component
const CustomAlert = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const getColor = () => {
    switch (type) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'info': return '#3b82f6';
      default: return '#3b82f6';
    }
  };

  return (
    <div className="alert-container">
      <div className={`alert alert-${type}`} style={{ borderLeftColor: getColor() }}>
        <span>{message}</span>
        <button onClick={onClose} className="alert-close">
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
      <style jsx>{`
        .alert-container {
          position: fixed;
          top: 80px;
          right: 20px;
          z-index: 10000;
          animation: slideIn 0.3s ease-out;
        }
        .alert {
          background: white;
          border-radius: 0.75rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 0.75rem 1rem;
          min-width: 260px;
          max-width: 360px;
          border-left: 3px solid;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .alert-success { border-left-color: #10b981; }
        .alert-error { border-left-color: #ef4444; }
        .alert-info { border-left-color: #3b82f6; }
        .alert-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

interface Post {
  id: string; 
  userId: string; 
  userName: string; 
  userPhotoURL?: string;
  description: string;
  imageUrl: string;
  mediaType?: string;
  embedUrl?: string;
  likedBy: string[]; 
  repostedBy: string[]; 
  isArchived: boolean; 
  createdAt: any;
}

interface Comment {
  id: string; 
  userId: string; 
  userName: string; 
  userPhotoURL?: string;
  text: string; 
  createdAt: any;
  replyTo?: string;
  replyToUserName?: string;
  replies?: Comment[];
}

const MediaContent = ({ post, style }: { post: Post; style?: any }) => {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
        <FontAwesomeIcon icon={faTimes} style={{ color: '#94a3b8' }} />
      </div>
    );
  }

  if (post.mediaType === 'youtube' && post.embedUrl) {
    return <iframe src={post.embedUrl} style={{ ...style, border: 'none' }} allowFullScreen />;
  }

  if (post.mediaType === 'video') {
    return <video src={post.imageUrl} style={style} controls playsInline />;
  }

  return <img src={post.imageUrl} style={style} onError={() => setError(true)} alt="Post" />;
};

export default function OthersProfile() {
  const { id } = useParams();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profileUser, setProfileUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'reposts' | 'liked'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [hasNotifiedProfileView, setHasNotifiedProfileView] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => setIsMobile(window.innerWidth < 768);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const showAlert = (message: string, type: 'success' | 'error' | 'info') => {
    setAlert({ message, type });
  };

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(u => setCurrentUser(u));
    const unsubProfile = onSnapshot(doc(db, 'users', id as string), (d) => {
      if (d.exists()) setProfileUser(d.data());
    });
    return () => { unsubAuth(); unsubProfile(); };
  }, [id]);

  // Notify profile view
  useEffect(() => {
    if (!currentUser || !id || currentUser.uid === id || hasNotifiedProfileView) return;

    const notifyProfileView = async () => {
      try {
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);
        
        const existingNotifQuery = query(
          collection(db, `users/${id}/notifications`),
          where('type', '==', 'profile_view'),
          where('senderId', '==', currentUser.uid),
          where('createdAt', '>', Timestamp.fromDate(oneHourAgo))
        );
        
        const existingNotif = await getDocs(existingNotifQuery);
        
        if (existingNotif.empty) {
          await addDoc(collection(db, `users/${id}/notifications`), {
            type: 'profile_view',
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'User',
            message: 'viewed your profile',
            relatedId: currentUser.uid,
            isRead: false,
            createdAt: serverTimestamp()
          });
          setHasNotifiedProfileView(true);
        }
      } catch (err) {
        console.error("Error notifying profile view:", err);
      }
    };

    notifyProfileView();
  }, [currentUser, id, hasNotifiedProfileView]);

  // Mark story as viewed
  useEffect(() => {
    if (!currentUser || !id || currentUser.uid === id) return;

    const markAsViewed = async () => {
      try {
        const now = Timestamp.now();
        const q = query(
          collection(db, 'stories'),
          where('userId', '==', id),
          where('expiresAt', '>', now),
          limit(1)
        );
        
        const snap = await getDocs(q);
        if (!snap.empty) {
          const storyDoc = snap.docs[0];
          const storyData = storyDoc.data();
          
          const alreadyViewed = storyData.viewers?.some((v: any) => v.uid === currentUser.uid);
          
          if (!alreadyViewed) {
            await updateDoc(doc(db, 'stories', storyDoc.id), {
              viewers: arrayUnion({
                uid: currentUser.uid,
                userName: currentUser.displayName || 'User',
                viewedAt: new Date().toISOString()
              })
            });
          }
        }
      } catch (err) {
        console.error("Error marking story as viewed:", err);
      }
    };

    markAsViewed();
  }, [currentUser, id]);

  // Load posts
  useEffect(() => {
    if (!id) return;
    const postsRef = collection(db, 'posts');
    let q;
    if (activeTab === 'posts') {
      q = query(postsRef, where('userId', '==', id), where('isArchived', '==', false), orderBy('createdAt', 'desc'));
    } else if (activeTab === 'reposts') {
      q = query(postsRef, where('repostedBy', 'array-contains', id), orderBy('createdAt', 'desc'));
    } else {
      q = query(postsRef, where('likedBy', 'array-contains', id), orderBy('createdAt', 'desc'));
    }
    
    return onSnapshot(q, (snap) => {
      const postsData = snap.docs.map(doc => {
        const data = doc.data();
        const url = data.imageUrl || "";
        let mediaType = data.mediaType;
        let embedUrl = data.embedUrl;

        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          mediaType = 'youtube';
          const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
          const match = url.match(regExp);
          const videoId = (match && match[2].length === 11) ? match[2] : null;
          embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : undefined;
        } else if (url.match(/\.(mp4|webm|ogg)$/i)) {
          mediaType = 'video';
        } else if (!mediaType) {
          mediaType = 'image';
        }

        return { id: doc.id, ...data, mediaType, embedUrl } as Post;
      });
      setPosts(postsData);
    });
  }, [id, activeTab]);

  // Load comments
  useEffect(() => {
    if (!selectedPost) return;
    const q = query(collection(db, `posts/${selectedPost.id}/comments`), orderBy('createdAt', 'asc'));
    
    return onSnapshot(q, (snap) => {
      const allComments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      
      const commentMap = new Map();
      const rootComments: Comment[] = [];
      
      allComments.forEach(comment => {
        comment.replies = [];
        commentMap.set(comment.id, comment);
        if (comment.replyTo) {
          const parent = commentMap.get(comment.replyTo);
          if (parent) {
            parent.replies = parent.replies || [];
            parent.replies.push(comment);
          }
        } else {
          rootComments.push(comment);
        }
      });
      
      rootComments.forEach(root => {
        if (root.replies) {
          root.replies.sort((a, b) => a.createdAt?.seconds - b.createdAt?.seconds);
        }
      });
      
      setComments(rootComments);
    });
  }, [selectedPost]);

  const createNotification = async (targetUserId: string, type: string, relatedId: string, message: string) => {
    if (!currentUser || targetUserId === currentUser.uid) return;
    try {
      await addDoc(collection(db, `users/${targetUserId}/notifications`), {
        type, senderId: currentUser.uid, senderName: currentUser.displayName || 'User',
        message, relatedId, isRead: false, createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error creating notification:", err);
    }
  };

  const handleLike = async (post: Post) => {
    if (!currentUser) return;
    const isLiked = post.likedBy?.includes(currentUser.uid);
    await updateDoc(doc(db, 'posts', post.id), { 
      likedBy: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) 
    });
    
    if (selectedPost?.id === post.id) {
      setSelectedPost({
        ...selectedPost,
        likedBy: isLiked ? selectedPost.likedBy?.filter(uid => uid !== currentUser.uid) : [...(selectedPost.likedBy || []), currentUser.uid]
      });
    }
    
    if (!isLiked) {
      await createNotification(post.userId, 'like', post.id, 'liked your post');
      showAlert('Post liked!', 'success');
    }
  };

  const handleRepost = async (post: Post) => {
    if (!currentUser || isReposting) return;
    setIsReposting(true);
    try {
      const isReposted = post.repostedBy?.includes(currentUser.uid);
      await updateDoc(doc(db, 'posts', post.id), { 
        repostedBy: isReposted ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid) 
      });
      
      if (!isReposted) {
        await createNotification(post.userId, 'share', post.id, 'reposted your post');
        showAlert('Post reposted!', 'success');
      }
    } catch (err) {
      showAlert('Failed to repost', 'error');
    } finally {
      setIsReposting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !selectedPost || !currentUser) return;
    
    try {
      const commentData: any = {
        userId: currentUser.uid, userName: currentUser.displayName || 'User',
        userPhotoURL: currentUser.photoURL || null, text: comment, createdAt: serverTimestamp()
      };
      
      if (replyTo) {
        commentData.replyTo = replyTo.id;
        commentData.replyToUserName = replyTo.userName;
      }
      
      await addDoc(collection(db, `posts/${selectedPost.id}/comments`), commentData);
      await createNotification(selectedPost.userId, 'comment', selectedPost.id, `commented: "${comment.substring(0, 50)}"`);
      
      if (replyTo && replyTo.userId !== currentUser.uid) {
        await createNotification(replyTo.userId, 'reply_comment', selectedPost.id, `replied to your comment`);
      }
      
      setComment('');
      setReplyTo(null);
      showAlert(replyTo ? 'Reply sent!' : 'Comment posted!', 'success');
    } catch (err) {
      showAlert('Failed to post comment', 'error');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedPost || !currentUser) return;
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteDoc(doc(db, `posts/${selectedPost.id}/comments`, commentId));
      showAlert('Comment deleted', 'success');
    } catch (err) {
      showAlert('Failed to delete comment', 'error');
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) newSet.delete(commentId);
      else newSet.add(commentId);
      return newSet;
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    showAlert('Profile link copied!', 'success');
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp?.seconds) return '';
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const renderComment = (comment: Comment, depth: number = 0) => {
    const isOwner = currentUser?.uid === comment.userId;
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    
    return (
      <div key={comment.id} style={{ marginLeft: depth > 0 ? '2rem' : '0', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div className="comment-avatar">
            {comment.userName?.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div className="comment-header">
              <span className="comment-name">{comment.userName}</span>
              {comment.replyTo && (
                <span className="comment-reply-to">replying to @{comment.replyToUserName}</span>
              )}
              <span className="comment-time">{formatTime(comment.createdAt)}</span>
            </div>
            <p className="comment-text">{comment.text}</p>
            <button onClick={() => setReplyTo(comment)} className="reply-btn">
              <FontAwesomeIcon icon={faReply} /> Reply
            </button>
          </div>
          {isOwner && (
            <button onClick={() => handleDeleteComment(comment.id)} className="delete-comment-btn">
              <FontAwesomeIcon icon={faTrashAlt} />
            </button>
          )}
        </div>
        
        {hasReplies && (
          <>
            {isExpanded ? (
              <div className="replies-container">
                {comment.replies!.map(reply => renderComment(reply, depth + 1))}
              </div>
            ) : (
              <button onClick={() => toggleReplies(comment.id)} className="show-replies-btn">
                <FontAwesomeIcon icon={faComment} />
                <span>{comment.replies!.length} replies</span>
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        {alert && <CustomAlert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}
        
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar" onClick={() => setShowActionMenu(true)}>
            {profileUser?.photoURL ? (
              <img src={profileUser.photoURL} alt={profileUser?.displayName} />
            ) : (
              <span>{profileUser?.displayName?.charAt(0).toUpperCase() || '?'}</span>
            )}
          </div>
          
          <div className="profile-info">
            <h1 className="profile-name">{profileUser?.displayName || 'Loading...'}</h1>
            <div className="profile-actions">
              <button onClick={() => router.push('/dashboard/chat')} className="message-btn">
                <FontAwesomeIcon icon={faEnvelope} />
                <span>Message</span>
              </button>
              <button onClick={handleCopyLink} className="copy-btn">
                <FontAwesomeIcon icon={faCopy} />
                <span>Share</span>
              </button>
              <button onClick={() => setShowActionMenu(true)} className="more-btn">
                <FontAwesomeIcon icon={faEllipsisH} />
              </button>
            </div>
          </div>
        </div>

        {/* Action Menu Modal */}
        {showActionMenu && (
          <div className="modal-overlay" onClick={() => setShowActionMenu(false)}>
            <div className="action-menu" onClick={e => e.stopPropagation()}>
              <button onClick={handleCopyLink}>
                <FontAwesomeIcon icon={faCopy} /> Copy profile link
              </button>
              <button onClick={() => router.push(`/dashboard/story/${id}`)}>
                <FontAwesomeIcon icon={faEye} /> View story
              </button>
              <button onClick={() => setShowActionMenu(false)} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs">
          {[
            { key: 'posts', label: 'Posts', icon: faThLarge },
            { key: 'reposts', label: 'Reposts', icon: faRetweet },
            { key: 'liked', label: 'Liked', icon: faHeart }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            >
              <FontAwesomeIcon icon={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Posts Grid */}
        <div className="posts-grid">
          {posts.map(post => (
            <div key={post.id} onClick={() => setSelectedPost(post)} className="post-card">
              <MediaContent post={post} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {post.mediaType === 'video' && (
                <div className="video-badge">
                  <FontAwesomeIcon icon={faPlay} />
                </div>
              )}
            </div>
          ))}
          {posts.length === 0 && (
            <div className="empty-state">
              {activeTab === 'posts' && 'No posts yet'}
              {activeTab === 'reposts' && 'No reposts yet'}
              {activeTab === 'liked' && 'No liked posts'}
            </div>
          )}
        </div>

        {/* Post Detail Modal */}
        {selectedPost && (
          <div className="modal-overlay" onClick={() => setSelectedPost(null)}>
            <div className="post-modal" onClick={e => e.stopPropagation()}>
              <div className="post-modal-media">
                <MediaContent post={selectedPost} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              
              <div className="post-modal-content">
                <div className="modal-header">
                  <div className="post-author">
                    <div className="author-avatar">
                      {selectedPost.userName?.charAt(0).toUpperCase()}
                    </div>
                    <strong>{selectedPost.userName}</strong>
                  </div>
                  <button onClick={() => setSelectedPost(null)} className="modal-close">
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
                
                <div className="post-description">
                  <p>{selectedPost.description}</p>
                </div>
                
                <div className="comments-area">
                  {replyTo && (
                    <div className="reply-indicator">
                      <span>Replying to <strong>{replyTo.userName}</strong></span>
                      <button onClick={() => setReplyTo(null)}>
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </div>
                  )}
                  
                  <div className="comments-list">
                    {comments.length === 0 ? (
                      <p className="no-comments">No comments yet</p>
                    ) : (
                      comments.map(comment => renderComment(comment))
                    )}
                  </div>
                </div>
                
                <div className="post-footer">
                  <div className="action-buttons">
                    <button onClick={() => handleLike(selectedPost)} className={`like-btn ${selectedPost.likedBy?.includes(currentUser?.uid) ? 'liked' : ''}`}>
                      <FontAwesomeIcon icon={faHeart} />
                      <span>{selectedPost.likedBy?.length || 0}</span>
                    </button>
                    <button onClick={() => handleRepost(selectedPost)} disabled={isReposting} className="repost-btn">
                      <FontAwesomeIcon icon={faRetweet} />
                      <span>{selectedPost.repostedBy?.length || 0}</span>
                    </button>
                    <button onClick={handleCopyLink} className="share-btn">
                      <FontAwesomeIcon icon={faShare} />
                    </button>
                  </div>
                  <div className="post-date">
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    {selectedPost.createdAt?.seconds && new Date(selectedPost.createdAt.seconds * 1000).toLocaleDateString()}
                  </div>
                  
                  <form onSubmit={handleAddComment} className="comment-form">
                    <div className="comment-input-wrapper">
                      <div className="comment-avatar-small">
                        {currentUser?.displayName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <input
                        type="text"
                        placeholder={replyTo ? `Reply to ${replyTo.userName}...` : "Write a comment..."}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="comment-input"
                      />
                    </div>
                    <button type="submit" disabled={!comment.trim()} className="send-btn">
                      <FontAwesomeIcon icon={faPaperPlane} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .profile-page {
          min-height: 100vh;
          background: transparent;
          padding: 5rem 1rem 3rem;
        }

        .profile-container {
          max-width: 900px;
          margin: 0 auto;
        }

        /* Profile Header */
        .profile-header {
          background: white;
          border-radius: 1.5rem;
          padding: 2rem;
          display: flex;
          align-items: center;
          gap: 2rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          border: 1px solid #eef2f6;
        }

        .profile-avatar {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
        }

        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-avatar span {
          font-size: 2.5rem;
          font-weight: 600;
          color: white;
        }

        .profile-info {
          flex: 1;
        }

        .profile-name {
          font-size: 1.5rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 1rem 0;
        }

        .profile-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .message-btn, .copy-btn, .more-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.813rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .message-btn {
          background: #3b82f6;
          color: white;
        }

        .message-btn:hover {
          background: #2563eb;
        }

        .copy-btn, .more-btn {
          background: #f1f5f9;
          color: #475569;
        }

        .copy-btn:hover, .more-btn:hover {
          background: #e2e8f0;
        }

        /* Tabs */
        .tabs {
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          background: white;
          padding: 0.25rem;
          border-radius: 2rem;
          border: 1px solid #eef2f6;
        }

        .tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1.5rem;
          border-radius: 2rem;
          font-size: 0.813rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          background: transparent;
          color: #64748b;
        }

        .tab.active {
          background: #3b82f6;
          color: white;
        }

        .tab:hover:not(.active) {
          background: #f1f5f9;
        }

        /* Posts Grid */
        .posts-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        .post-card {
          aspect-ratio: 1 / 1;
          cursor: pointer;
          border-radius: 0.75rem;
          overflow: hidden;
          position: relative;
          background: #f1f5f9;
          transition: transform 0.2s;
        }

        .post-card:hover {
          transform: scale(1.02);
        }

        .video-badge {
          position: absolute;
          bottom: 0.5rem;
          right: 0.5rem;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          font-size: 0.688rem;
        }

        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 3rem;
          background: white;
          border-radius: 1rem;
          color: #94a3b8;
          font-size: 0.875rem;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .action-menu {
          background: white;
          border-radius: 1rem;
          width: 100%;
          max-width: 280px;
          overflow: hidden;
          box-shadow: 0 20px 35px -8px rgba(0, 0, 0, 0.2);
        }

        .action-menu button {
          width: 100%;
          padding: 0.875rem 1rem;
          border: none;
          background: none;
          cursor: pointer;
          text-align: left;
          font-size: 0.875rem;
          color: #334155;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          transition: background 0.2s;
        }

        .action-menu button:hover {
          background: #f8fafc;
        }

        .action-menu .cancel-btn {
          border-top: 1px solid #eef2f6;
          color: #94a3b8;
          justify-content: center;
        }

        /* Post Modal */
        .post-modal {
          background: white;
          border-radius: 1.5rem;
          width: 100%;
          max-width: 900px;
          max-height: 85vh;
          display: flex;
          flex-direction: row;
          overflow: hidden;
        }

        .post-modal-media {
          flex: 1.5;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .post-modal-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 1.25rem;
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #f0f2f5;
        }

        .post-author {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .author-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
        }

        .modal-close {
          background: #f1f5f9;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
        }

        .post-description {
          padding: 0.75rem 0;
          border-bottom: 1px solid #f0f2f5;
        }

        .post-description p {
          font-size: 0.875rem;
          color: #334155;
          margin: 0;
        }

        .comments-area {
          flex: 1;
          overflow-y: auto;
          padding: 0.75rem 0;
        }

        .reply-indicator {
          background: #eff6ff;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          margin-bottom: 0.75rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
        }

        .comments-list {
          max-height: 280px;
          overflow-y: auto;
        }

        .no-comments {
          text-align: center;
          color: #94a3b8;
          font-size: 0.75rem;
          padding: 1rem;
        }

        .comment-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 0.75rem;
          font-weight: 600;
          flex-shrink: 0;
        }

        .comment-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 0.25rem;
        }

        .comment-name {
          font-weight: 600;
          font-size: 0.75rem;
          color: #1e293b;
        }

        .comment-reply-to {
          font-size: 0.688rem;
          color: #94a3b8;
        }

        .comment-time {
          font-size: 0.625rem;
          color: #cbd5e1;
        }

        .comment-text {
          font-size: 0.75rem;
          color: #475569;
          margin: 0 0 0.25rem 0;
        }

        .reply-btn {
          background: none;
          border: none;
          font-size: 0.688rem;
          color: #3b82f6;
          cursor: pointer;
          padding: 0;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }

        .delete-comment-btn {
          background: none;
          border: none;
          color: #cbd5e1;
          cursor: pointer;
          padding: 0.25rem;
        }

        .delete-comment-btn:hover {
          color: #ef4444;
        }

        .replies-container {
          margin-top: 0.5rem;
          padding-left: 1rem;
          border-left: 1px solid #e2e8f0;
          margin-left: 0.75rem;
        }

        .show-replies-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.5rem;
          background: #f8fafc;
          border: none;
          border-radius: 0.375rem;
          font-size: 0.688rem;
          color: #64748b;
          cursor: pointer;
          margin-top: 0.5rem;
          margin-left: 2rem;
        }

        .post-footer {
          border-top: 1px solid #f0f2f5;
          padding-top: 0.75rem;
        }

        .action-buttons {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .like-btn, .repost-btn, .share-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          font-size: 1rem;
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
        }

        .like-btn.liked {
          color: #ef4444;
        }

        .post-date {
          font-size: 0.625rem;
          color: #cbd5e1;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          margin-bottom: 0.75rem;
        }

        .comment-form {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .comment-input-wrapper {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #f8fafc;
          padding: 0.375rem 0.75rem;
          border-radius: 2rem;
        }

        .comment-avatar-small {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 0.688rem;
          font-weight: 600;
          flex-shrink: 0;
        }

        .comment-input {
          flex: 1;
          padding: 0.5rem 0;
          border: none;
          background: transparent;
          outline: none;
          font-size: 0.75rem;
        }

        .send-btn {
          background: #3b82f6;
          color: white;
          border: none;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .send-btn:disabled {
          background: #cbd5e1;
          cursor: not-allowed;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .profile-page {
            padding: 4rem 0.75rem 2rem;
          }

          .profile-header {
            flex-direction: column;
            text-align: center;
            padding: 1.5rem;
          }

          .profile-avatar {
            width: 80px;
            height: 80px;
          }

          .profile-avatar span {
            font-size: 2rem;
          }

          .profile-name {
            font-size: 1.25rem;
          }

          .profile-actions {
            justify-content: center;
          }

          .tabs {
            padding: 0.25rem;
          }

          .tab span {
            display: none;
          }

          .tab {
            padding: 0.5rem;
          }

          .posts-grid {
            gap: 0.5rem;
          }

          .post-modal {
            flex-direction: column;
            max-height: 90vh;
          }

          .post-modal-media {
            min-height: 250px;
          }
        }
      `}</style>
    </div>
  );
}