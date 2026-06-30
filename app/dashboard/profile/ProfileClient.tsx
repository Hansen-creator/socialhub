'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { updateProfile, User } from 'firebase/auth';
import { 
  collection, query, where, orderBy, onSnapshot, 
  doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, addDoc, serverTimestamp, limit, Timestamp 
} from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHeart, faComment, faPaperPlane, faTimes,
  faEye, faReply, faChevronRight, faTrashAlt, faArchive, 
  faBoxArchive, faPencilAlt, faSave, faCamera
} from '@fortawesome/free-solid-svg-icons';

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
    <div className="custom-alert-box" style={{ borderLeft: `4px solid ${getColor()}` }}>
      <span className="alert-text">{message}</span>
      <button onClick={onClose} className="alert-close-btn" aria-label="Close alert">
        <FontAwesomeIcon icon={faTimes} />
      </button>
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
    return <iframe src={post.embedUrl} title="YouTube player" style={{ ...style, border: 'none', width: '100%', height: '100%' }} allowFullScreen />;
  }

  if (post.mediaType === 'tiktok' && post.embedUrl) {
    return <iframe src={post.embedUrl} title="TikTok player" style={{ ...style, border: 'none', width: '100%', height: '100%' }} allow="fullscreen" />;
  }

  if (post.mediaType === 'video') {
    return <video src={post.imageUrl} style={style} controls={!!onClick} playsInline />;
  }

  return <img src={post.imageUrl} style={style} onClick={onClick} onError={() => setError(true)} alt="Konten Publikasi Pembuat" />;
};

export default function ProfileClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
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

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
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
    setNewPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setNewPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const compressImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new globalThis.Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handleSaveProfile = async () => {
    if (!user || !newName.trim()) return;
    setIsSaving(true);
    try {
      let finalPhotoURL = dbUserData?.photoURL || null;
      if (newPhotoFile && newPhotoPreview) {
        finalPhotoURL = await compressImage(newPhotoPreview);
      }
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: newName,
        photoURL: finalPhotoURL,
        updatedAt: serverTimestamp()
      });
      await updateProfile(auth.currentUser!, { displayName: newName });
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
      if (newSet.has(commentId)) newSet.delete(commentId);
      else newSet.add(commentId);
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
    if (hours < 24) return `${hours} hours ago`;
    return `${days} days ago`;
  };

  const renderComment = (comment: Comment, depth: number = 0) => {
    const isOwner = user?.uid === comment.userId;
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    const maxDepth = 3;
    
    return (
      <div key={comment.id} className={`comment-depth-wrapper ${depth > 0 ? 'nested-comment' : ''}`}>
        <div className={depth > 0 ? 'nested-comment-bubble' : 'root-comment-bubble'}>
          <div className="comment-main-flex">
            <div className="comment-content-left">
              <div className="comment-avatar-placeholder">
                {comment.userName?.charAt(0).toUpperCase()}
              </div>
              <div className="comment-text-block">
                <div className="comment-meta">
                  <span className="comment-author-name">{comment.userName}</span>
                  {comment.replyTo && <span className="reply-target">replying to <strong>{comment.replyToUserName}</strong></span>}
                  <span className="comment-timestamp">{formatTime(comment.createdAt)}</span>
                </div>
                <p className="comment-actual-text">{comment.text}</p>
                <button onClick={() => setReplyTo(comment)} className="comment-reply-trigger">
                  <FontAwesomeIcon icon={faReply} /> Reply
                </button>
              </div>
            </div>
            {isOwner && (
              <button onClick={() => handleDeleteComment(comment.id)} className="comment-delete-trigger" aria-label="Delete comment">
                <FontAwesomeIcon icon={faTrashAlt} />
              </button>
            )}
          </div>
        </div>
        
        {hasReplies && isExpanded && depth < maxDepth && (
          <div className="nested-replies-container">
            {comment.replies!.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
        
        {hasReplies && !isExpanded && depth < maxDepth && (
          <div onClick={() => toggleReplies(comment.id)} className="expand-replies-pill">
            <FontAwesomeIcon icon={faComment} />
            <span>{comment.replies!.length} replies</span>
            <FontAwesomeIcon icon={faChevronRight} />
          </div>
        )}
      </div>
    );
  };

  const displayPhoto = newPhotoPreview || dbUserData?.photoURL;

  return (
    <div className="profile-page">
      <div className="profile-container">
        {alert && <CustomAlert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}
        
        {/* Profile Header */}
        <header className="profile-header">
          <div className="profile-avatar-section">
            <div className="avatar-wrapper">
              {displayPhoto ? (
                <img src={displayPhoto} alt="Foto Profil Utama Pengembang" className="profile-avatar" />
              ) : (
                <div className="avatar-placeholder">
                  {(newName || user?.displayName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              {isEditing && (
                <label className="avatar-upload-btn" aria-label="Upload new profile picture">
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

                <div className="user-id" onClick={handleCopyId} role="button" tabIndex={0} aria-label="Salin User ID">
                  <span>User ID:</span>
                  <code>{user?.uid ? user.uid.substring(0, 8) : '...'}...</code>
                  <span className="copy-hint">Click to copy</span>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Active Story Banner */}
        {myActiveStory && (
          <div className="story-banner">
            <div className="story-info">
              <span className="story-image-icon" role="img" aria-label="Story Icon">📱</span>
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
        <nav className="tabs-container" aria-label="Profile tabs">
          {['posts', 'reposts', 'liked', 'archived'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            >
              {tab === 'posts' ? 'Posts' : tab === 'reposts' ? 'Reposts' : tab === 'liked' ? 'Liked' : 'Archived'}
            </button>
          ))}
        </nav>

        {/* Posts Grid */}
        <section className="posts-grid">
          {posts.map(post => (
            <article key={post.id} onClick={() => setSelectedPost(post)} className="post-card" role="button" tabIndex={0}>
              <MediaContent post={post} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {post.isArchived && (
                <div className="archived-badge">
                  <FontAwesomeIcon icon={faBoxArchive} /> Archived
                </div>
              )}
            </article>
          ))}
          {posts.length === 0 && (
            <div className="empty-state">
              {activeTab === 'posts' && 'No posts yet'}
              {activeTab === 'reposts' && 'No reposted content'}
              {activeTab === 'liked' && 'No liked posts'}
              {activeTab === 'archived' && 'No archived posts'}
            </div>
          )}
        </section>

        {/* Viewer List Modal */}
        {showViewerList && (
          <div className="modal-overlay" onClick={() => setShowViewerList(false)}>
            <div className="modal-container" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Viewed by</h2>
                <button onClick={() => setShowViewerList(false)} className="modal-close" aria-label="Close modal">
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
                  <button onClick={() => setSelectedPost(null)} className="modal-close" aria-label="Tutup Detail Postingan">
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
                      <button onClick={() => setReplyTo(null)} aria-label="Batal balas">
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
                    <button onClick={() => handleLike(selectedPost)} className={`action-btn ${selectedPost.likedBy?.includes(user?.uid) ? 'liked' : ''}`} aria-label="Sukai postingan">
                      <FontAwesomeIcon icon={faHeart} />
                      <span>{selectedPost.likedBy?.length || 0}</span>
                    </button>
                    <button onClick={() => handleToggleArchive(selectedPost)} className="action-btn" aria-label="Arsipkan postingan">
                      <FontAwesomeIcon icon={faArchive} />
                    </button>
                    {selectedPost.userId === user?.uid && (
                      <button onClick={() => handleDeletePost(selectedPost.id)} className="action-btn delete-btn" aria-label="Hapus postingan">
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
                    <button type="submit" disabled={!comment.trim()} className="comment-submit" aria-label="Kirim komentar">
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
        /* Custom Alert */
        .custom-alert-box { position: fixed; top: 80px; right: 20px; z-index: 10000; animation: slideIn 0.3s ease-out; max-width: calc(100vw - 40px); background-color: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 12px 16px; min-width: 280px; max-width: 400px; display: flex; align-items: center; gap: 12px; }
        .alert-text { flex: 1; font-size: 13px; color: #333; }
        .alert-close-btn { background: none; border: none; cursor: pointer; color: #999; font-size: 14px; }

        /* Comments Readability Improvements */
        .comment-depth-wrapper { margin-bottom: 12px; }
        .nested-comment { margin-left: 35px; }
        .nested-comment-bubble { background-color: #f8f9fa; padding: 8px; border-radius: 10px; border-left: 2px solid #3b82f6; }
        .root-comment-bubble { padding: 4px 0; }
        .comment-main-flex { display: flex; justify-content: space-between; alignItems: flex-start; gap: 10px; }
        .comment-content-left { flex: 1; display: flex; gap: 10px; }
        .comment-avatar-placeholder { width: 30px; height: 30px; flex-shrink: 0; border-radius: 50%; background: #3b82f6; display: flex; alignItems: center; justifyContent: center; color: white; font-size: 12px; font-weight: bold; }
        .comment-text-block { flex: 1; }
        .comment-meta { display: flex; alignItems: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
        .comment-author-name { font-weight: bold; color: #3b82f6; font-size: 12px; }
        .reply-target { font-size: 10px; color: #888; }
        .comment-timestamp { font-size: 10px; color: #aaa; }
        .comment-actual-text { margin: 4px 0; font-size: 12px; color: #333; line-height: 1.4; }
        .comment-reply-trigger { background: none; border: none; font-size: 10px; color: #3b82f6; cursor: pointer; padding: 4px 0; display: inline-flex; alignItems: center; gap: 4px; }
        .comment-delete-trigger { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 12px; padding: 4px; }
        .nested-replies-container { marginTop: 6px; padding-left: 15px; border-left: 1px dashed #e0e0e0; marginLeft: 10px; }
        .expand-replies-pill { marginTop: 5px; marginLeft: 15px; padding: 4px 8px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; font-size: 10px; color: #666; display: inline-flex; alignItems: center; gap: 5px; }

        /* Base Profile Layout */
        .profile-page { min-height: 100vh; background: transparent; padding: 5rem 1.5rem 3rem; }
        .profile-container { max-width: 1000px; margin: 0 auto; }
        .profile-header { background: white; border-radius: 1.5rem; padding: 2rem; display: flex; align-items: center; gap: 2rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); border: 1px solid #eef2f6; }
        .avatar-wrapper { position: relative; width: 120px; height: 120px; }
        .profile-avatar { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 3px solid white; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
        .avatar-placeholder { width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #2563eb); display: flex; align-items: center; justify-content: center; font-size: 3rem; font-weight: 600; color: white; }
        .avatar-upload-btn { position: absolute; bottom: 0; right: 0; width: 36px; height: 36px; background: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; border: 3px solid white; transition: all 0.2s; }
        .profile-name { font-size: 1.75rem; font-weight: 600; color: #1e293b; margin: 0 0 0.25rem 0; }
        .profile-email { color: #64748b; font-size: 0.875rem; margin: 0 0 1rem 0; }
        .profile-actions { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
        .edit-profile-btn { background: #f1f5f9; color: #334155; padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.813rem; font-weight: 500; cursor: pointer; border: none; }
        .new-post-btn { background: #3b82f6; color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.813rem; font-weight: 500; cursor: pointer; border: none; }
        .user-id { display: inline-flex; align-items: center; gap: 0.5rem; background: #f8fafc; padding: 0.375rem 0.75rem; border-radius: 0.5rem; font-size: 0.75rem; cursor: pointer; }
        .user-id code { font-family: monospace; color: #3b82f6; }
        .copy-hint { color: #94a3b8; font-size: 0.688rem; }
        .story-banner { background: #fef3c7; border-radius: 1rem; padding: 1rem 1.5rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .story-info { display: flex; align-items: center; gap: 0.75rem; }
        .story-title { font-weight: 600; color: #92400e; font-size: 0.875rem; }
        .story-expiry { font-size: 0.75rem; color: #b45309; }
        .viewers-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: #f59e0b; color: white; border: none; border-radius: 2rem; font-size: 0.75rem; font-weight: 500; cursor: pointer; }
        .tabs-container { display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 1.5rem; background: white; padding: 0.25rem; border-radius: 2rem; border: 1px solid #eef2f6; }
        .tab-btn { padding: 0.625rem 1.5rem; border-radius: 2rem; font-size: 0.813rem; font-weight: 500; cursor: pointer; border: none; background: transparent; color: #64748b; }
        .tab-btn.active { background: #3b82f6; color: white; }
        .posts-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        .post-card { aspect-ratio: 1 / 1; cursor: pointer; border-radius: 0.75rem; overflow: hidden; position: relative; background: #f1f5f9; }
        .archived-badge { position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(0, 0, 0, 0.7); color: white; font-size: 0.688rem; padding: 0.25rem 0.5rem; border-radius: 0.375rem; display: flex; align-items: center; gap: 0.25rem; }
        .empty-state { grid-column: 1 / -1; text-align: center; padding: 3rem; background: white; border-radius: 1rem; color: #94a3b8; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal-container { background: white; border-radius: 1.5rem; width: 100%; max-width: 400px; overflow: hidden; }
        .post-modal { background: white; border-radius: 1.5rem; width: 100%; max-width: 900px; max-height: 85vh; display: flex; flex-direction: row; overflow: hidden; }
        .post-modal-media { flex: 1.5; background: #000; display: flex; align-items: center; justify-content: center; min-height: 300px; }
        .post-modal-content { flex: 1; display: flex; flex-direction: column; padding: 1.25rem; overflow: hidden; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 0.75rem; border-bottom: 1px solid #f0f2f5; }
        .modal-close { background: #f1f5f9; width: 32px; height: 32px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #64748b; }
        .post-description { padding: 0.75rem 0; border-bottom: 1px solid #f0f2f5; }
        .comments-section { flex: 1; overflow-y: auto; padding: 0.75rem 0; }
        .comments-list { max-height: 250px; overflow-y: auto; }
        .post-actions { border-top: 1px solid #f0f2f5; padding-top: 0.75rem; }
        .action-buttons { display: flex; gap: 1rem; margin-bottom: 0.75rem; }
        .action-btn { background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 1.125rem; display: inline-flex; align-items: center; gap: 0.375rem; }
        .action-btn.liked { color: #ef4444; }
        .comment-form { display: flex; gap: 0.5rem; background: #f8fafc; padding: 0.5rem; border-radius: 2rem; }
        .comment-input { flex: 1; padding: 0.5rem 1rem; border: none; background: transparent; outline: none; font-size: 0.813rem; }
        .comment-submit { background: #3b82f6; color: white; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; }
        .viewer-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-bottom: 1px solid #f0f2f5; }
        .viewer-avatar { width: 40px; height: 40px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; }
        .viewer-name { font-weight: 500; color: #1e293b; }

        @media (max-width: 768px) {
          .profile-page { padding: 4rem 1rem 2rem; }
          .profile-header { flex-direction: column; text-align: center; padding: 1.5rem; }
          .profile-actions { justify-content: center; }
          .user-id { justify-content: center; }
          .posts-grid { grid-template-columns: repeat(2, 1fr); gap: 0.5rem; }
          .post-modal { flex-direction: column; max-height: 90vh; }
          .post-modal-media { min-height: 250px; max-height: 250px; }
          .nested-comment { margin-left: 20px; }
          .nested-replies-container { padding-left: 8px; }
        }
      `}</style>
    </div>
  );
}
