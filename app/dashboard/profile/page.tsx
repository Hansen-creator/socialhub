'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { updateProfile } from 'firebase/auth';
import { 
  collection, query, where, orderBy, onSnapshot, 
  doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, addDoc, serverTimestamp, limit, Timestamp 
} from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHeart, faComment, faRetweet, faPaperPlane, faTimes,
  faUser, faEye, faClock, faCalendar, faReply, faChevronRight,
  faChevronDown, faTrashAlt, faShare, faLink, faPlay, faExternalLink,
  faCheckCircle, faTimesCircle, faInfoCircle, faArchive, faBoxArchive,
  faBars, faArrowLeft, faUserCircle, faImages, faBookmark,
  faPencilAlt, faSave, faCamera
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
    <div style={{
      position: 'fixed',
      top: '80px',
      right: '20px',
      zIndex: 10000,
      animation: 'slideIn 0.3s ease-out',
      maxWidth: 'calc(100vw - 40px)'
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        padding: '12px 16px',
        minWidth: '280px',
        maxWidth: '400px',
        borderLeft: `4px solid ${getColor()}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ flex: 1, fontSize: '13px', color: '#333' }}>{message}</span>
        <button onClick={onClose} style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#999',
          fontSize: '14px'
        }}>
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
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
  mediaType?: 'image' | 'video' | 'youtube' | 'tiktok' | 'link';
  embedUrl?: string;
  externalProvider?: string;
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

const MediaContent = ({ post, onClick, style }: { post: Post; onClick?: () => void; style?: any }) => {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div onClick={onClick} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', minHeight: '150px' }}>
        <FontAwesomeIcon icon={faTimes} style={{ color: '#999' }} />
      </div>
    );
  }

  if (post.mediaType === 'youtube' && post.embedUrl) {
    return <iframe src={post.embedUrl} style={{ ...style, border: 'none', width: '100%', height: '100%' }} allowFullScreen />;
  }

  if (post.mediaType === 'tiktok' && post.embedUrl) {
    return <iframe src={post.embedUrl} style={{ ...style, border: 'none', width: '100%', height: '100%' }} allow="fullscreen" />;
  }

  if (post.mediaType === 'video') {
    return <video src={post.imageUrl} style={style} controls={!!onClick} playsInline />;
  }

  return <img src={post.imageUrl} style={style} onClick={onClick} onError={() => setError(true)} alt="Content" />;
};

export default function MyProfile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [dbUserData, setDbUserData] = useState<any>(null); 
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'reposts' | 'liked' | 'archived'>('posts');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [myActiveStory, setMyActiveStory] = useState<any>(null);
  const [showViewerList, setShowViewerList] = useState(false);
  
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const showAlert = (message: string, type: 'success' | 'error' | 'info') => {
    setAlert({ message, type });
  };

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (!u) {
        router.push('/login');
      } else {
        setUser(u);
        setNewName(u.displayName || '');
        const unsubDoc = onSnapshot(doc(db, 'users', u.uid), (docSnap) => {
          if (docSnap.exists()) setDbUserData(docSnap.data());
        });
        return () => unsubDoc();
      }
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const postsRef = collection(db, 'posts');
    let q;
    
    if (activeTab === 'posts') {
      q = query(postsRef, where('userId', '==', user.uid), where('isArchived', '==', false), orderBy('createdAt', 'desc'));
    } else if (activeTab === 'reposts') {
      q = query(postsRef, where('repostedBy', 'array-contains', user.uid), orderBy('createdAt', 'desc'));
    } else if (activeTab === 'liked') {
      q = query(postsRef, where('likedBy', 'array-contains', user.uid), orderBy('createdAt', 'desc'));
    } else if (activeTab === 'archived') {
      q = query(postsRef, where('userId', '==', user.uid), where('isArchived', '==', true), orderBy('createdAt', 'desc'));
    } else {
      return;
    }

    return onSnapshot(q, (snap) => {
      const postsData = snap.docs.map(d => {
        const data = d.data();
        const url = data.imageUrl || "";
        let mediaType = data.mediaType;
        let embedUrl = data.embedUrl;

        if (url.includes('youtube.com') || url.includes('youtu.be')) {
          mediaType = 'youtube';
          const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
          const match = url.match(regExp);
          const videoId = (match && match[2].length === 11) ? match[2] : null;
          embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : undefined;
        } else if (url.includes('tiktok.com')) {
          mediaType = 'tiktok';
          const tiktokId = url.split('/video/')[1]?.split('?')[0];
          embedUrl = tiktokId ? `https://www.tiktok.com/embed/v2/${tiktokId}` : undefined;
        } else if (!mediaType) {
          mediaType = url.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image';
        }

        return { id: d.id, ...data, mediaType, embedUrl } as Post;
      });
      setPosts(postsData);
    });
  }, [user, activeTab]);

  useEffect(() => {
    if (!selectedPost) return;
    const q = query(collection(db, `posts/${selectedPost.id}/comments`), orderBy('createdAt', 'asc'));
    
    return onSnapshot(q, (snap) => {
      const allComments = snap.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, replies: [] } as Comment;
      });
      
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

  useEffect(() => {
    if (!user) return;
    const now = Timestamp.now();
    const q = query(
      collection(db, 'stories'),
      where('userId', '==', user.uid),
      where('expiresAt', '>', now),
      limit(1)
    );

    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const storyDoc = snap.docs[0];
        const data = storyDoc.data();
        
        const uniqueViewers: any[] = [];
        const viewerMap = new Map();
        
        if (data.viewers && Array.isArray(data.viewers)) {
          data.viewers.forEach((v: any) => {
            if (!viewerMap.has(v.uid)) {
              viewerMap.set(v.uid, true);
              uniqueViewers.push(v);
            }
          });
        }

        setMyActiveStory({ id: storyDoc.id, ...data, viewers: uniqueViewers });
      } else {
        setMyActiveStory(null);
      }
    });
  }, [user]);

  const handleCopyId = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      showAlert("User ID copied to clipboard", 'success');
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      showAlert("Photo size must be less than 1MB", 'error');
      return;
    }
    if (!file.type.startsWith('image/')) {
      showAlert("Please select an image file", 'error');
      return;
    }
    
    setNewPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setNewPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const compressImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedDataUrl);
      };
    });
  };

  const handleSaveProfile = async () => {
    if (!user || !newName.trim()) return;
    setIsSaving(true);
    try {
      let finalPhotoURL = dbUserData?.photoURL || null;
      
      if (newPhotoFile) {
        const previewUrl = newPhotoPreview;
        if (previewUrl) {
          // Kompresi sangat kuat agar di bawah 1MB untuk Firestore
          finalPhotoURL = await compressImage(previewUrl);
        }
      }
      
      // JANGAN updateProfile di Firebase Auth jika menggunakan Base64
      // Cukup update di Firestore saja
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: newName,
        photoURL: finalPhotoURL,
        updatedAt: serverTimestamp()
      });
      
      // Update nama saja di Auth (karena string pendek tidak akan error)
      await updateProfile(auth.currentUser!, { 
        displayName: newName
        // photoURL dikosongkan/tidak diupdate di sini
      });
      
      setIsEditing(false);
      setNewPhotoFile(null);
      setNewPhotoPreview(null);
      showAlert("Profile updated successfully", 'success');
    } catch (err: any) {
      showAlert(`Error: ${err.message}`, 'error');
    } finally { setIsSaving(false); }
  };

  const handleLike = async (post: Post) => {
    if (!user) return;
    const isLiked = post.likedBy?.includes(user.uid);
    await updateDoc(doc(db, 'posts', post.id), { 
      likedBy: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) 
    });
    if (selectedPost?.id === post.id) {
      setSelectedPost({
        ...selectedPost,
        likedBy: isLiked 
          ? selectedPost.likedBy?.filter(uid => uid !== user.uid) 
          : [...(selectedPost.likedBy || []), user.uid]
      });
    }
  };

  const handleToggleArchive = async (post: Post) => {
    await updateDoc(doc(db, 'posts', post.id), { isArchived: !post.isArchived });
    setSelectedPost(null);
    showAlert(post.isArchived ? 'Post unarchived' : 'Post archived', 'success');
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this post permanently?')) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setSelectedPost(null);
      showAlert('Post deleted successfully', 'success');
    } catch (err) {
      showAlert('Failed to delete post', 'error');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !selectedPost || !user) return;
    
    try {
      const commentData: any = {
        userId: user.uid,
        userName: dbUserData?.displayName || user.displayName || 'User',
        userPhotoURL: dbUserData?.photoURL || user.photoURL || null,
        text: comment,
        createdAt: serverTimestamp()
      };
      
      if (replyTo) {
        commentData.replyTo = replyTo.id;
        commentData.replyToUserName = replyTo.userName;
      }
      
      await addDoc(collection(db, `posts/${selectedPost.id}/comments`), commentData);
      setComment('');
      setReplyTo(null);
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedPost || !user) return;
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteDoc(doc(db, `posts/${selectedPost.id}/comments`, commentId));
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
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
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const renderComment = (comment: Comment, depth: number = 0) => {
    const isOwner = user?.uid === comment.userId;
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    const maxDepth = 3;
    
    return (
      <div key={comment.id} style={{ marginLeft: depth > 0 ? (isMobile ? '20px' : '35px') : '0', marginBottom: '12px' }}>
        <div style={{ 
          backgroundColor: depth > 0 ? '#f8f9fa' : 'transparent',
          padding: depth > 0 ? (isMobile ? '6px' : '8px') : '0',
          borderRadius: depth > 0 ? '10px' : '0',
          borderLeft: depth > 0 ? '2px solid #3b82f6' : 'none'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ flex: 1, display: 'flex', gap: '10px' }}>
              <div style={{ 
                width: '30px', 
                height: '30px', 
                flexShrink: 0, 
                borderRadius: '50%', 
                background: '#3b82f6', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: 'white', 
                fontSize: '12px', 
                fontWeight: 'bold' 
              }}>
                {comment.userName?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '12px' }}>{comment.userName}</span>
                  {comment.replyTo && <span style={{ fontSize: '10px', color: '#888' }}>replying to <strong>{comment.replyToUserName}</strong></span>}
                  <span style={{ fontSize: '10px', color: '#aaa' }}>{formatTime(comment.createdAt)}</span>
                </div>
                <p style={{ margin: '4px 0', fontSize: '12px', color: '#333', lineHeight: '1.4' }}>{comment.text}</p>
                <button onClick={() => setReplyTo(comment)} style={{ background: 'none', border: 'none', fontSize: '10px', color: '#3b82f6', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FontAwesomeIcon icon={faReply} /> Reply
                </button>
              </div>
            </div>
            {isOwner && (
              <button onClick={() => handleDeleteComment(comment.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', padding: '4px' }}>
                <FontAwesomeIcon icon={faTrashAlt} />
              </button>
            )}
          </div>
        </div>
        
        {hasReplies && isExpanded && depth < maxDepth && (
          <div style={{ marginTop: '6px', paddingLeft: isMobile ? '8px' : '15px', borderLeft: '1px dashed #e0e0e0', marginLeft: '10px' }}>
            {comment.replies!.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
        
        {hasReplies && !isExpanded && depth < maxDepth && (
          <div onClick={() => toggleReplies(comment.id)} style={{ marginTop: '5px', marginLeft: '15px', padding: '4px 8px', backgroundColor: '#f5f5f5', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', color: '#666', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <FontAwesomeIcon icon={faComment} />
            <span>{comment.replies!.length} replies</span>
            <FontAwesomeIcon icon={faChevronRight} />
          </div>
        )}
      </div>
    );
  };

  const getGridColumns = () => {
    if (isMobile) return 'repeat(2, 1fr)';
    return 'repeat(3, 1fr)';
  };

  const getModalHeight = () => isMobile ? '90vh' : '85vh';
  const isModalColumn = isMobile;

  const displayPhoto = newPhotoPreview || dbUserData?.photoURL;

  return (
    <div className="profile-page">
      <div className="profile-container">
        {alert && <CustomAlert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}
        
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar-section">
            <div className="avatar-wrapper">
              {displayPhoto ? (
                <img src={displayPhoto} alt="Profile" className="profile-avatar" />
              ) : (
                <div className="avatar-placeholder">
                  {(newName || user?.displayName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              {isEditing && (
                <label className="avatar-upload-btn">
                  <FontAwesomeIcon icon={faCamera} />
                  <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                </label>
              )}
            </div>
          </div>

          <div className="profile-info">
            {isEditing ? (
              <div className="edit-form">
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  className="edit-name-input"
                  placeholder="Your name"
                />
                <div className="edit-actions">
                  <button onClick={handleSaveProfile} disabled={isSaving} className="save-btn">
                    <FontAwesomeIcon icon={faSave} />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => { 
                    setIsEditing(false); 
                    setNewPhotoFile(null);
                    setNewPhotoPreview(null);
                  }} className="cancel-btn">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="profile-name">{dbUserData?.displayName || user?.displayName}</h1>
                <p className="profile-email">{user?.email}</p>
                
                <div className="profile-actions">
                  <button onClick={() => setIsEditing(true)} className="edit-profile-btn">
                    <FontAwesomeIcon icon={faPencilAlt} />
                    Edit Profile
                  </button>
                  <button onClick={() => router.push('/dashboard/upload')} className="new-post-btn">
                    New Post
                  </button>
                </div>

                <div className="user-id" onClick={handleCopyId}>
                  <span>User ID:</span>
                  <code>{user?.uid.substring(0, 8)}...</code>
                  <span className="copy-hint">Click to copy</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Active Story Banner */}
        {myActiveStory && (
          <div className="story-banner">
            <div className="story-info">
              <div className="story-icon">📱</div>
              <div>
                <div className="story-title">Your story is active</div>
                <div className="story-expiry">Expires in 24 hours</div>
              </div>
            </div>
            <button onClick={() => setShowViewerList(true)} className="viewers-btn">
              <FontAwesomeIcon icon={faEye} />
              {myActiveStory.viewers?.length || 0} viewers
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs-container">
          {['posts', 'reposts', 'liked', 'archived'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            >
              {tab === 'posts' ? 'Posts' : tab === 'reposts' ? 'Reposts' : tab === 'liked' ? 'Liked' : 'Archived'}
            </button>
          ))}
        </div>

        {/* Posts Grid */}
        <div className="posts-grid">
          {posts.map(post => (
            <div key={post.id} onClick={() => setSelectedPost(post)} className="post-card">
              <MediaContent post={post} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {post.isArchived && (
                <div className="archived-badge">
                  <FontAwesomeIcon icon={faBoxArchive} /> Archived
                </div>
              )}
            </div>
          ))}
          {posts.length === 0 && (
            <div className="empty-state">
              {activeTab === 'posts' && 'No posts yet'}
              {activeTab === 'reposts' && 'No reposted content'}
              {activeTab === 'liked' && 'No liked posts'}
              {activeTab === 'archived' && 'No archived posts'}
            </div>
          )}
        </div>

        {/* Viewer List Modal */}
        {showViewerList && (
          <div className="modal-overlay" onClick={() => setShowViewerList(false)}>
            <div className="modal-container" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Viewed by</h3>
                <button onClick={() => setShowViewerList(false)} className="modal-close">
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
              <div className="modal-body">
                {myActiveStory?.viewers?.length > 0 ? (
                  myActiveStory.viewers.map((v: any) => (
                    <div key={v.uid} className="viewer-item">
                      <div className="viewer-avatar">
                        {v.userName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="viewer-name">{v.userName}</div>
                    </div>
                  ))
                ) : (
                  <div className="empty-viewers">No viewers yet</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Post Detail Modal */}
        {selectedPost && (
          <div className="modal-overlay" onClick={() => setSelectedPost(null)}>
            <div className="post-modal" onClick={e => e.stopPropagation()}>
              <div className="post-modal-media">
                <MediaContent post={selectedPost} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              
              <div className="post-modal-content">
                <div className="modal-header">
                  <strong className="post-author">{selectedPost.userName}</strong>
                  <button onClick={() => setSelectedPost(null)} className="modal-close">
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
                
                <div className="post-description">
                  <p>{selectedPost.description}</p>
                </div>
                
                <div className="comments-section">
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
                
                <div className="post-actions">
                  <div className="action-buttons">
                    <button onClick={() => handleLike(selectedPost)} className={`action-btn ${selectedPost.likedBy?.includes(user?.uid) ? 'liked' : ''}`}>
                      <FontAwesomeIcon icon={faHeart} />
                      <span>{selectedPost.likedBy?.length || 0}</span>
                    </button>
                    <button onClick={() => handleToggleArchive(selectedPost)} className="action-btn">
                      <FontAwesomeIcon icon={faArchive} />
                    </button>
                    {selectedPost.userId === user?.uid && (
                      <button onClick={() => handleDeletePost(selectedPost.id)} className="action-btn delete-btn">
                        <FontAwesomeIcon icon={faTrashAlt} />
                      </button>
                    )}
                  </div>
                  
                  <form onSubmit={handleAddComment} className="comment-form">
                    <input 
                      type="text" 
                      placeholder={replyTo ? "Write a reply..." : "Write a comment..."} 
                      value={comment} 
                      onChange={(e) => setComment(e.target.value)} 
                      className="comment-input"
                    />
                    <button type="submit" disabled={!comment.trim()} className="comment-submit">
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
          padding: 5rem 1.5rem 3rem;
        }

        .profile-container {
          max-width: 1000px;
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
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          border: 1px solid #eef2f6;
        }

        .profile-avatar-section {
          flex-shrink: 0;
        }

        .avatar-wrapper {
          position: relative;
          width: 120px;
          height: 120px;
        }

        .profile-avatar {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .avatar-placeholder {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          font-weight: 600;
          color: white;
        }

        .avatar-upload-btn {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 36px;
          height: 36px;
          background: #3b82f6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: white;
          border: 3px solid white;
          transition: all 0.2s;
        }

        .avatar-upload-btn:hover {
          background: #2563eb;
          transform: scale(1.05);
        }

        .profile-info {
          flex: 1;
        }

        .profile-name {
          font-size: 1.75rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 0.25rem 0;
        }

        .profile-email {
          color: #64748b;
          font-size: 0.875rem;
          margin: 0 0 1rem 0;
        }

        .profile-actions {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .edit-profile-btn, .new-post-btn {
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

        .edit-profile-btn {
          background: #f1f5f9;
          color: #334155;
        }

        .edit-profile-btn:hover {
          background: #e2e8f0;
        }

        .new-post-btn {
          background: #3b82f6;
          color: white;
        }

        .new-post-btn:hover {
          background: #2563eb;
        }

        .user-id {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: #f8fafc;
          padding: 0.375rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .user-id:hover {
          background: #e2e8f0;
        }

        .user-id code {
          font-family: monospace;
          color: #3b82f6;
        }

        .copy-hint {
          color: #94a3b8;
          font-size: 0.688rem;
        }

        /* Edit Form */
        .edit-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-width: 300px;
        }

        .edit-name-input {
          padding: 0.75rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s;
        }

        .edit-name-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .edit-actions {
          display: flex;
          gap: 0.75rem;
        }

        .save-btn, .cancel-btn {
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.813rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .save-btn {
          background: #10b981;
          color: white;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .save-btn:hover:not(:disabled) {
          background: #059669;
        }

        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .cancel-btn {
          background: #f1f5f9;
          color: #64748b;
        }

        .cancel-btn:hover {
          background: #e2e8f0;
        }

        /* Story Banner */
        .story-banner {
          background: #fef3c7;
          border-radius: 1rem;
          padding: 1rem 1.5rem;
          margin-bottom: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .story-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .story-icon {
          font-size: 1.5rem;
        }

        .story-title {
          font-weight: 600;
          color: #92400e;
          font-size: 0.875rem;
        }

        .story-expiry {
          font-size: 0.75rem;
          color: #b45309;
        }

        .viewers-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: #f59e0b;
          color: white;
          border: none;
          border-radius: 2rem;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .viewers-btn:hover {
          background: #d97706;
        }

        /* Tabs */
        .tabs-container {
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          background: white;
          padding: 0.25rem;
          border-radius: 2rem;
          border: 1px solid #eef2f6;
        }

        .tab-btn {
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

        .tab-btn.active {
          background: #3b82f6;
          color: white;
        }

        .tab-btn:hover:not(.active) {
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
          transition: all 0.2s;
        }

        .post-card:hover {
          transform: scale(1.02);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .archived-badge {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          font-size: 0.688rem;
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
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

        .modal-container {
          background: white;
          border-radius: 1.5rem;
          width: 100%;
          max-width: 400px;
          overflow: hidden;
        }

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
          min-height: 300px;
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
          font-weight: 600;
          color: #1e293b;
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
          transition: all 0.2s;
        }

        .modal-close:hover {
          background: #e2e8f0;
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

        .comments-section {
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

        .reply-indicator button {
          background: none;
          border: none;
          cursor: pointer;
          color: #64748b;
        }

        .comments-list {
          max-height: 250px;
          overflow-y: auto;
        }

        .no-comments {
          text-align: center;
          color: #94a3b8;
          font-size: 0.75rem;
          padding: 1rem;
        }

        .post-actions {
          border-top: 1px solid #f0f2f5;
          padding-top: 0.75rem;
        }

        .action-buttons {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.75rem;
        }

        .action-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #94a3b8;
          font-size: 1.125rem;
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          transition: all 0.2s;
        }

        .action-btn:hover {
          color: #3b82f6;
        }

        .action-btn.liked {
          color: #ef4444;
        }

        .delete-btn:hover {
          color: #ef4444;
        }

        .comment-form {
          display: flex;
          gap: 0.5rem;
          background: #f8fafc;
          padding: 0.5rem;
          border-radius: 2rem;
        }

        .comment-input {
          flex: 1;
          padding: 0.5rem 1rem;
          border: none;
          background: transparent;
          outline: none;
          font-size: 0.813rem;
        }

        .comment-submit {
          background: #3b82f6;
          color: white;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
        }

        .comment-submit:disabled {
          background: #cbd5e1;
          cursor: not-allowed;
        }

        .comment-submit:hover:not(:disabled) {
          background: #2563eb;
        }

        .viewer-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border-bottom: 1px solid #f0f2f5;
        }

        .viewer-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
        }

        .viewer-name {
          font-weight: 500;
          color: #1e293b;
        }

        .empty-viewers {
          text-align: center;
          padding: 2rem;
          color: #94a3b8;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .profile-page {
            padding: 4rem 1rem 2rem;
          }

          .profile-header {
            flex-direction: column;
            text-align: center;
            padding: 1.5rem;
          }

          .profile-actions {
            justify-content: center;
          }

          .user-id {
            justify-content: center;
          }

          .edit-form {
            max-width: 100%;
            align-items: center;
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
            max-height: 250px;
          }

          .tabs-container {
            flex-wrap: wrap;
          }

          .tab-btn {
            padding: 0.5rem 1rem;
          }
        }
      `}</style>
    </div>
  );
}