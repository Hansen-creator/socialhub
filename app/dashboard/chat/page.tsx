'use client';

import { useState, useEffect, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { 
  collection, query, where, orderBy, onSnapshot, 
  addDoc, serverTimestamp, doc, updateDoc, writeBatch, 
  arrayUnion, arrayRemove, getDoc, getDocs, setDoc,
  deleteDoc
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHeart, faComment, faPaperPlane, faTimes, faUser,
  faClock, faReply, faChevronRight, faPaperclip, faUserPlus,
  faBell, faCheck, faTimes as faTimesCircle, faUsers, 
  faSearch, faUserFriends, faUserCheck, faClock as faClockIcon,
  faBars, faArrowLeft, faEllipsisV, faInfoCircle, faPhone,
  faVideo, faImage, faSmile, faTrash, faEdit, faCheckDouble
} from '@fortawesome/free-solid-svg-icons';

// --- Tipe Data ---
interface ChatRoom {
  id: string; 
  participants: string[]; 
  updatedAt: any; 
  lastMessage?: string;
  isPinned?: { [key: string]: boolean };
  status?: 'pending' | 'active' | 'rejected';
}

interface SharedPost {
  postId: string;
  userId: string;
  userName: string;
  userPhotoURL?: string | null;
  description: string;
  imageUrl: string;
  mediaType?: string;
  likedBy: number;
  repostedBy: number;
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

interface Message {
  id: string; 
  text: string; 
  senderId: string; 
  createdAt: any; 
  readBy: string[]; 
  likedBy?: string[];
  storyRef?: string;
  todoId?: string;
  sharedPost?: SharedPost;
  type?: string;
  editedAt?: any;
  isDeleted?: boolean;
  deletedFor?: string[];
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
    senderId: string;
  };
}

interface UserProfile {
  uid: string; 
  displayName: string; 
  email?: string;
  photoURL?: string;
  status: 'online' | 'away' | 'offline';
  friends?: string[];
  friendRequests?: {
    sent: string[];
    received: string[];
  };
  bio?: string;
  createdAt?: any;
  lastLogin?: any;
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  fromUserPhotoURL?: string;
  toUserName: string;
  toUserPhotoURL?: string;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
  respondedAt?: any;
}

interface FullPost {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  description: string;
  imageUrl: string;
  mediaType?: string;
  likedBy: string[];
  repostedBy: string[];
  createdAt: any;
}

// Fungsi untuk inisialisasi user di Firestore
const initializeUserInFirestore = async (user: User) => {
  if (!user) return false;
  
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName || 'Pengguna',
        email: user.email || '',
        photoURL: user.photoURL || null,
        friends: [],
        status: 'online',
        bio: '',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
      return true;
    } else {
      await updateDoc(userRef, {
        lastLogin: serverTimestamp(),
        status: 'online'
      });
      return true;
    }
  } catch (error) {
    console.error('Error initializing user:', error);
    return false;
  }
};

// Komponen Media
const MediaContent = ({ url, mediaType, style }: { url: string; mediaType?: string; style?: any }) => {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', color: '#999', height: '200px' }}>
        Gagal memuat media
      </div>
    );
  }
  if (mediaType === 'video') {
    return <video src={url} style={style} controls playsInline onError={() => setError(true)} />;
  }
  return <img src={url} style={style} onError={() => setError(true)} alt="Post" />;
};

// Komentar Component
const CommentItem = ({ comment, currentUserId, onReply, formatTime, depth = 0 }: { 
  comment: Comment; 
  currentUserId: string; 
  onReply: (comment: Comment) => void;
  formatTime: (timestamp: any) => string;
  depth?: number;
}) => {
  const [expandedReplies, setExpandedReplies] = useState(false);
  const hasReplies = comment.replies && comment.replies.length > 0;
  const maxDepth = 3;

  return (
    <div style={{ marginLeft: depth > 0 ? '35px' : '0', marginBottom: '12px' }}>
      <div style={{ 
        backgroundColor: depth > 0 ? '#f8f9fa' : 'transparent',
        padding: depth > 0 ? '8px' : '0',
        borderRadius: depth > 0 ? '10px' : '0',
        borderLeft: depth > 0 ? '2px solid #4285F4' : 'none'
      }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', flexShrink: 0, borderRadius: '50%', background: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
            {comment.userPhotoURL ? (
              <img src={comment.userPhotoURL} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt={comment.userName} />
            ) : (
              comment.userName?.charAt(0).toUpperCase() || '?'
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#4285F4' }}>{comment.userName}</span>
              {comment.replyTo && (
                <span style={{ fontSize: '11px', color: '#888' }}>↳ membalas <strong>{comment.replyToUserName}</strong></span>
              )}
              <span style={{ fontSize: '10px', color: '#aaa' }}>{formatTime(comment.createdAt)}</span>
            </div>
            <p style={{ margin: '4px 0', fontSize: '13px', color: '#333', lineHeight: '1.4' }}>{comment.text}</p>
            <button 
              onClick={() => onReply(comment)}
              style={{ background: 'none', border: 'none', fontSize: '11px', color: '#4285F4', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <FontAwesomeIcon icon={faReply} style={{ fontSize: '10px' }} /> Balas
            </button>
          </div>
        </div>
      </div>
      
      {hasReplies && expandedReplies && depth < maxDepth && (
        <div style={{ marginTop: '8px' }}>
          {comment.replies!.map(reply => (
            <CommentItem key={reply.id} comment={reply} currentUserId={currentUserId} onReply={onReply} formatTime={formatTime} depth={depth + 1} />
          ))}
        </div>
      )}
      
      {hasReplies && !expandedReplies && depth < maxDepth && (
        <div onClick={() => setExpandedReplies(true)} style={{ marginTop: '5px', marginLeft: '10px', padding: '5px 10px', backgroundColor: '#f0f0f0', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', color: '#666', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <FontAwesomeIcon icon={faComment} style={{ fontSize: '10px' }} />
          <span>{comment.replies!.length} balasan</span>
          <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: '8px' }} />
        </div>
      )}
    </div>
  );
};

// Komponen Popup Post
const PostPopup = ({ postId, currentUser, onClose, usersMap }: { 
  postId: string; 
  currentUser: any; 
  onClose: () => void;
  usersMap: { [key: string]: UserProfile };
}) => {
  const [post, setPost] = useState<FullPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    const loadPost = async () => {
      try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
          const postData = { id: postSnap.id, ...postSnap.data() } as FullPost;
          setPost(postData);
          setLiked(postData.likedBy?.includes(currentUser?.uid) || false);
          setLikeCount(postData.likedBy?.length || 0);
        }
      } catch (error) {
        console.error('Error loading post:', error);
      } finally {
        setLoading(false);
      }
    };
    loadPost();
  }, [postId, currentUser]);

  useEffect(() => {
    if (!postId) return;
    const q = query(collection(db, `posts/${postId}/comments`), orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const allComments = snap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          userPhotoURL: usersMap[data.userId]?.photoURL,
          replies: data.replies || [],
        } as Comment; 
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
          root.replies.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        }
      });
      
      setComments(rootComments);
    });
    
    return () => unsubscribe();
  }, [postId, usersMap]);

  const handleLike = async () => {
    if (!post || !currentUser) return;
    try {
      const postRef = doc(db, 'posts', post.id);
      if (liked) {
        await updateDoc(postRef, {
          likedBy: arrayRemove(currentUser.uid)
        });
        setLikeCount(prev => prev - 1);
      } else {
        await updateDoc(postRef, {
          likedBy: arrayUnion(currentUser.uid)
        });
        setLikeCount(prev => prev + 1);
      }
      setLiked(!liked);
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !post || !currentUser) return;
    
    try {
      const commentData: any = {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'User',
        userPhotoURL: currentUser.photoURL || null,
        text: newComment,
        createdAt: serverTimestamp()
      };
      
      if (replyTo) {
        commentData.replyTo = replyTo.id;
        commentData.replyToUserName = replyTo.userName;
      }
      
      await addDoc(collection(db, `posts/${post.id}/comments`), commentData);
      setNewComment('');
      setReplyTo(null);
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const formatTimeLocal = (timestamp: any) => {
    if (!timestamp?.seconds) return '';
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return `${minutes} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    return `${days} hari lalu`;
  };

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '40px', textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid #4285F4', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <p>Memuat postingan...</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '30px', textAlign: 'center' }}>
          <p>Postingan tidak ditemukan</p>
          <button onClick={onClose} style={{ marginTop: '16px', padding: '8px 20px', background: '#4285F4', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer' }}>Tutup</button>
        </div>
      </div>
    );
  }

  return (
    <div 
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px' }}
      onClick={onClose}
    >
      <div 
        style={{ backgroundColor: 'white', borderRadius: '28px', maxWidth: '500px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(45deg, #4285F4, #34a853)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '16px' }}>
              {post.userPhotoURL ? (
                <img src={post.userPhotoURL} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt={post.userName} />
              ) : (
                post.userName?.charAt(0).toUpperCase() || '?'
              )}
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{post.userName}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>{formatTimeLocal(post.createdAt)}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ backgroundColor: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
            <MediaContent url={post.imageUrl} mediaType={post.mediaType} style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }} />
          </div>

          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
            <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#333', whiteSpace: 'pre-wrap' }}>{post.description}</p>
          </div>

          <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={handleLike} style={{ background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', padding: 0 }}>
              <span style={{ color: liked ? '#ff4444' : '#666' }}>{liked ? '❤️' : '🤍'}</span>
            </button>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{likeCount} suka</span>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FontAwesomeIcon icon={faComment} /> Komentar ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})
            </h4>
            
            {replyTo && (
              <div style={{ backgroundColor: '#e3f2fd', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span>Membalas <strong>{replyTo.userName}</strong>: "{replyTo.text.substring(0, 40)}"</span>
                <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }}>✕</button>
              </div>
            )}
            
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
              {comments.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>Belum ada komentar</p>
              ) : (
                comments.map(comment => (
                  <CommentItem key={comment.id} comment={comment} currentUserId={currentUser?.uid} onReply={setReplyTo} formatTime={formatTimeLocal} />
                ))
              )}
            </div>
            
            <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '10px', borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 }}>
                {currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="avatar" />
                ) : (
                  currentUser?.displayName?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <input 
                type="text" 
                placeholder={replyTo ? `Balas ke ${replyTo.userName}...` : "Tulis komentar..."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                style={{ flex: 1, padding: '10px 16px', borderRadius: '20px', border: '1px solid #e0e0e0', outline: 'none', fontSize: '13px' }}
              />
              <button type="submit" disabled={!newComment.trim()} style={{ padding: '0 20px', background: newComment.trim() ? '#4285F4' : '#ccc', color: 'white', border: 'none', borderRadius: '20px', fontWeight: 'bold', cursor: newComment.trim() ? 'pointer' : 'not-allowed' }}>
                Kirim
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

// Komponen Add Friend Modal
const AddFriendModal = ({ isOpen, onClose, currentUser, onFriendRequestSent }: { 
  isOpen: boolean; 
  onClose: () => void; 
  currentUser: User;
  onFriendRequestSent: () => void;
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Masukkan nama pengguna');
      return;
    }

    setLoading(true);
    setError('');
    setSearchResults([]);

    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef, 
        where('displayName', '>=', searchTerm), 
        where('displayName', '<=', searchTerm + '\uf8ff')
      );
      const querySnapshot = await getDocs(q);
      
      const results: UserProfile[] = [];
      querySnapshot.forEach(doc => {
        const userData = doc.data() as UserProfile;
        if (doc.id !== currentUser.uid) {
          results.push({ ...userData, uid: doc.id });
        }
      });
      
      setSearchResults(results);
      
      if (results.length === 0) {
        setError('User tidak ditemukan');
      }
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Gagal mencari user');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (targetUser: UserProfile) => {
    setSendingRequest(targetUser.uid);
    setError('');
    setMessage('');

    try {
      const currentUserRef = doc(db, 'users', currentUser.uid);
      let currentUserSnap = await getDoc(currentUserRef);
      
      if (!currentUserSnap.exists()) {
        await setDoc(currentUserRef, {
          uid: currentUser.uid,
          displayName: currentUser.displayName || 'Pengguna',
          email: currentUser.email || '',
          photoURL: currentUser.photoURL || null,
          friends: [],
          status: 'online',
          bio: '',
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });
        currentUserSnap = await getDoc(currentUserRef);
      }
      
      const currentUserData = currentUserSnap.data() as UserProfile;
      const friendsList = currentUserData.friends || [];
      
      if (friendsList.includes(targetUser.uid)) {
        setError(`Anda sudah berteman dengan ${targetUser.displayName}`);
        setSendingRequest(null);
        return;
      }

      const targetUserRef = doc(db, 'users', targetUser.uid);
      const targetUserSnap = await getDoc(targetUserRef);
      
      if (!targetUserSnap.exists()) {
        setError(`User ${targetUser.displayName} tidak ditemukan di database`);
        setSendingRequest(null);
        return;
      }

      const pendingFromMeQuery = query(
        collection(db, 'friendRequests'),
        where('fromUserId', '==', currentUser.uid),
        where('toUserId', '==', targetUser.uid),
        where('status', '==', 'pending')
      );
      const pendingFromMeSnap = await getDocs(pendingFromMeQuery);
      
      if (!pendingFromMeSnap.empty) {
        setError(`Permintaan pertemanan ke ${targetUser.displayName} sudah dikirim dan menunggu konfirmasi`);
        setSendingRequest(null);
        return;
      }

      const pendingToMeQuery = query(
        collection(db, 'friendRequests'),
        where('fromUserId', '==', targetUser.uid),
        where('toUserId', '==', currentUser.uid),
        where('status', '==', 'pending')
      );
      const pendingToMeSnap = await getDocs(pendingToMeQuery);
      
      if (!pendingToMeSnap.empty) {
        setError(`${targetUser.displayName} sudah mengirimkan permintaan pertemanan. Silakan cek notifikasi.`);
        setSendingRequest(null);
        return;
      }

      await addDoc(collection(db, 'friendRequests'), {
        fromUserId: currentUser.uid,
        toUserId: targetUser.uid,
        fromUserName: currentUser.displayName || 'Pengguna',
        fromUserPhotoURL: currentUser.photoURL || null,
        toUserName: targetUser.displayName,
        toUserPhotoURL: targetUser.photoURL || null,
        message: `Halo ${targetUser.displayName}! Apakah anda ingin berteman dengan saya?`,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      setMessage(`✅ Permintaan pertemanan terkirim ke ${targetUser.displayName}!`);
      setTimeout(() => {
        onFriendRequestSent();
        setSearchTerm('');
        setMessage('');
        setSearchResults([]);
        onClose();
      }, 2000);
      
    } catch (err) {
      console.error('Error sending friend request:', err);
      setError('Gagal mengirim permintaan. Silakan coba lagi.');
    } finally {
      setSendingRequest(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '24px', width: '500px', maxWidth: '100%', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '80vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 'clamp(18px, 5vw, 20px)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FontAwesomeIcon icon={faUserPlus} style={{ color: '#4285F4' }} /> Tambah Teman
        </h3>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>
          Cari pengguna berdasarkan nama untuk mengirim permintaan pertemanan
        </p>
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Cari nama pengguna..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #ddd', fontSize: '14px', minWidth: '150px' }}
          />
          <button 
            onClick={handleSearch}
            disabled={loading}
            style={{ padding: '12px 20px', background: '#4285F4', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <FontAwesomeIcon icon={faSearch} /> Cari
          </button>
        </div>
        
        {error && (
          <div style={{ color: '#e74c3c', fontSize: '12px', marginBottom: '12px', padding: '10px', background: '#fee', borderRadius: '8px' }}>
            ❌ {error}
          </div>
        )}
        
        {message && (
          <div style={{ color: '#27ae60', fontSize: '12px', marginBottom: '12px', padding: '10px', background: '#e8f5e9', borderRadius: '8px' }}>
            {message}
          </div>
        )}
        
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ width: '30px', height: '30px', border: '3px solid #f3f3f3', borderTop: '3px solid #4285F4', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            <p style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>Mencari pengguna...</p>
          </div>
        )}
        
        {searchResults.length > 0 && (
          <>
            <div style={{ marginBottom: '12px', fontWeight: 'bold', fontSize: '13px', color: '#666' }}>
              Hasil pencarian ({searchResults.length})
            </div>
            {searchResults.map(user => (
              <div key={user.uid} style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px', flexShrink: 0 }}>
                  {user.photoURL ? (
                    <img src={user.photoURL} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt={user.displayName} />
                  ) : (
                    user.displayName?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{user.displayName}</div>
                  <div style={{ fontSize: '11px', color: '#999' }}>
                    {user.email || 'No email'}
                  </div>
                  {user.bio && <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{user.bio}</div>}
                </div>
                <button 
                  onClick={() => handleSendRequest(user)}
                  disabled={sendingRequest === user.uid}
                  style={{ 
                    padding: '8px 16px', 
                    background: sendingRequest === user.uid ? '#ccc' : '#4285F4', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '20px', 
                    cursor: sendingRequest === user.uid ? 'not-allowed' : 'pointer', 
                    fontSize: '13px', 
                    fontWeight: 'bold',
                    minWidth: '80px'
                  }}
                >
                  {sendingRequest === user.uid ? 'Mengirim...' : 'Tambah'}
                </button>
              </div>
            ))}
          </>
        )}
        
        {searchResults.length === 0 && !loading && !error && searchTerm && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <FontAwesomeIcon icon={faUserFriends} style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.5 }} />
            <p>Tidak ada pengguna dengan nama "{searchTerm}"</p>
            <p style={{ fontSize: '11px', marginTop: '8px' }}>Pastikan nama yang Anda cari sudah benar</p>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: '#e0e0e0', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

// Komponen Friends List Modal
const FriendsListModal = ({ isOpen, onClose, currentUser, usersMap }: { 
  isOpen: boolean; 
  onClose: () => void; 
  currentUser: User;
  usersMap: { [key: string]: UserProfile };
}) => {
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const loadFriends = async () => {
      setLoading(true);
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          setFriends([]);
          return;
        }
        const userData = userSnap.data() as UserProfile;
        const friendIds = userData.friends || [];
        
        const friendList: UserProfile[] = [];
        for (const friendId of friendIds) {
          const friendData = usersMap[friendId];
          if (friendData) {
            friendList.push({ ...friendData, uid: friendId });
          }
        }
        setFriends(friendList);
      } catch (error) {
        console.error('Error loading friends:', error);
        setFriends([]);
      } finally {
        setLoading(false);
      }
    };

    loadFriends();
  }, [isOpen, currentUser, usersMap]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '24px', width: '450px', maxWidth: '100%', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '80vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 'clamp(18px, 5vw, 20px)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FontAwesomeIcon icon={faUserFriends} style={{ color: '#4285F4' }} /> Daftar Teman
        </h3>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>
          Total {friends.length} {friends.length === 1 ? 'teman' : 'teman'}
        </p>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ width: '30px', height: '30px', border: '3px solid #f3f3f3', borderTop: '3px solid #4285F4', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        ) : friends.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <FontAwesomeIcon icon={faUserFriends} style={{ fontSize: '40px', marginBottom: '12px' }} />
            <p>Anda belum memiliki teman</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>Tambahkan teman untuk memulai percakapan</p>
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {friends.map(friend => (
              <div key={friend.uid} style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px' }}>
                  {friend.photoURL ? (
                    <img src={friend.photoURL} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt={friend.displayName} />
                  ) : (
                    friend.displayName?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{friend.displayName}</div>
                  <div style={{ fontSize: '11px', color: '#999', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: friend.status === 'online' ? '#27ae60' : '#95a5a6' }} />
                    {friend.status === 'online' ? 'Online' : 'Offline'}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#4285F4' }}>
                  <FontAwesomeIcon icon={faUserCheck} />
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: '#e0e0e0', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

// Komponen Friend Request Notifications
const FriendRequestNotifications = ({ currentUser, usersMap, onRequestResponded }: { 
  currentUser: User; 
  usersMap: { [key: string]: UserProfile };
  onRequestResponded: () => void;
}) => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'friendRequests'),
      where('toUserId', '==', currentUser.uid),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const requestList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FriendRequest[];
      setRequests(requestList);
      setUnreadCount(requestList.length);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      const requestRef = doc(db, 'friendRequests', requestId);
      const requestSnap = await getDoc(requestRef);
      const requestData = requestSnap.data() as FriendRequest;

      if (accept) {
        await updateDoc(requestRef, {
          status: 'accepted',
          respondedAt: serverTimestamp()
        });

        const user1Ref = doc(db, 'users', requestData.fromUserId);
        const user2Ref = doc(db, 'users', requestData.toUserId);

        await updateDoc(user1Ref, {
          friends: arrayUnion(requestData.toUserId)
        });
        
        await updateDoc(user2Ref, {
          friends: arrayUnion(requestData.fromUserId)
        });

        const chatRoomQuery = query(
          collection(db, 'chats'),
          where('participants', 'array-contains', requestData.fromUserId)
        );
        
        const chatRoomSnap = await getDocs(chatRoomQuery);
        let existingChat = false;
        
        chatRoomSnap.forEach(doc => {
          const participants = doc.data().participants;
          if (participants.includes(requestData.fromUserId) && participants.includes(requestData.toUserId)) {
            existingChat = true;
          }
        });

        if (!existingChat) {
          await addDoc(collection(db, 'chats'), {
            participants: [requestData.fromUserId, requestData.toUserId],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: 'active'
          });
        }
      } else {
        await updateDoc(requestRef, {
          status: 'rejected',
          respondedAt: serverTimestamp()
        });
      }

      onRequestResponded();
      setShowDropdown(false);
    } catch (error) {
      console.error('Error responding to friend request:', error);
    }
  };

  if (requests.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '50%', transition: '0.2s' }}
      >
        <FontAwesomeIcon icon={faBell} style={{ fontSize: '20px', color: '#555' }} />
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: '0', right: '0', background: '#e74c3c', color: 'white', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowDropdown(false)} />
          <div style={{ position: 'absolute', top: '50px', right: '0', width: 'min(380px, calc(100vw - 20px))', background: 'white', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', zIndex: 1000, overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0', fontWeight: 'bold', fontSize: '16px', background: '#f8f9fa' }}>
              Permintaan Pertemanan ({requests.length})
            </div>
            <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
              {requests.map(request => (
                <div key={request.id} style={{ padding: '16px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '18px', flexShrink: 0 }}>
                      {request.fromUserPhotoURL ? (
                        <img src={request.fromUserPhotoURL} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt={request.fromUserName} />
                      ) : (
                        request.fromUserName?.charAt(0).toUpperCase() || '?'
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '15px' }}>{request.fromUserName}</div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', lineHeight: '1.4' }}>
                        {request.message || `Halo, apakah anda ingin berteman dengan saya?`}
                      </div>
                      <div style={{ fontSize: '11px', color: '#999', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FontAwesomeIcon icon={faClockIcon} style={{ fontSize: '10px' }} />
                        Dikirim: {request.createdAt?.seconds ? new Date(request.createdAt.seconds * 1000).toLocaleDateString('id-ID') : 'Baru saja'}
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          onClick={() => handleRespond(request.id, true)}
                          style={{ flex: 1, padding: '8px', background: '#4285F4', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <FontAwesomeIcon icon={faCheck} /> Setuju
                        </button>
                        <button 
                          onClick={() => handleRespond(request.id, false)}
                          style={{ flex: 1, padding: '8px', background: '#e0e0e0', color: '#666', border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          <FontAwesomeIcon icon={faTimesCircle} /> Tolak
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Message Action Menu Modal (Edit/Delete/Reply)
const MessageActionModal = ({ 
  isOpen, 
  onClose, 
  message, 
  onEdit, 
  onDelete,
  onReply 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  message: Message | null;
  onEdit: (messageId: string, newText: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReply: (message: Message) => void;
}) => {
  const [editText, setEditText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (message && message.text) {
      setEditText(message.text);
    }
  }, [message]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !editText.trim()) return;
    await onEdit(message.id, editText);
    setIsEditing(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!message) return;
    if (confirm('Apakah Anda yakin ingin menghapus pesan ini?')) {
      await onDelete(message.id);
      onClose();
    }
  };

  const handleReply = () => {
    if (message) {
      onReply(message);
      onClose();
    }
  };

  if (!isOpen || !message) return null;

  const isOwnMessage = message.senderId === currentUser?.uid;

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0,0,0,0.5)', 
      backdropFilter: 'blur(5px)', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      zIndex: 10000, 
      padding: '16px' 
    }}>
      <div style={{ 
        background: '#fff', 
        width: 'min(400px, calc(100vw - 32px))', 
        borderRadius: '24px', 
        overflow: 'hidden', 
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        animation: 'slideUp 0.2s ease'
      }}>
        {!isEditing ? (
          <>
            <div style={{ padding: '20px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Aksi Pesan</h3>
            </div>
            {/* Reply Button - Available for all messages */}
            <div 
              onClick={handleReply}
              style={{ 
                padding: '16px 20px', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                borderBottom: '1px solid #f5f5f5',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <FontAwesomeIcon icon={faReply} style={{ color: '#4285F4', width: '20px' }} />
              <span>Balas Pesan</span>
            </div>
            {/* Edit Button - Only for own messages */}
            {isOwnMessage && !message.isDeleted && (
              <div 
                onClick={() => setIsEditing(true)}
                style={{ 
                  padding: '16px 20px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  borderBottom: '1px solid #f5f5f5',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <FontAwesomeIcon icon={faEdit} style={{ color: '#4285F4', width: '20px' }} />
                <span>Edit Pesan</span>
              </div>
            )}
            {/* Delete Button - Only for own messages */}
            {isOwnMessage && (
              <div 
                onClick={handleDelete}
                style={{ 
                  padding: '16px 20px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  borderBottom: '1px solid #f5f5f5',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <FontAwesomeIcon icon={faTrash} style={{ color: '#e74c3c', width: '20px' }} />
                <span style={{ color: '#e74c3c' }}>Hapus Pesan</span>
              </div>
            )}
            <div 
              onClick={onClose}
              style={{ 
                padding: '16px 20px', 
                cursor: 'pointer', 
                textAlign: 'center',
                color: '#666',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Batal
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: '20px', borderBottom: '1px solid #f0f0f0' }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Edit Pesan</h3>
            </div>
            <form onSubmit={handleEditSubmit} style={{ padding: '20px' }}>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  resize: 'vertical',
                  minHeight: '80px',
                  fontFamily: 'inherit'
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={{ flex: 1, padding: '10px', background: '#e0e0e0', border: 'none', borderRadius: '12px', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!editText.trim()}
                  style={{ flex: 1, padding: '10px', background: editText.trim() ? '#4285F4' : '#ccc', color: 'white', border: 'none', borderRadius: '12px', cursor: editText.trim() ? 'pointer' : 'not-allowed' }}
                >
                  Simpan
                </button>
              </div>
            </form>
          </>
        )}
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

// MAIN CHAT PAGE COMPONENT - Fully Responsive with Layout Lock for All Devices
export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [activeChat, setActiveChat] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [usersMap, setUsersMap] = useState<{ [key: string]: UserProfile }>({});
  const [showActionMenu, setShowActionMenu] = useState<{ open: boolean, uid: string, name: string }>({ open: false, uid: '', name: '' });
  const [selectedPost, setSelectedPost] = useState<{ postId: string } | null>(null);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showFriendsListModal, setShowFriendsListModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [messageAction, setMessageAction] = useState<{ open: boolean, message: Message | null }>({ open: false, message: null });
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Detect screen size for responsive layout
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      const tablet = width >= 768 && width < 1024;
      setIsMobile(mobile);
      setIsTablet(tablet);
      
      if (mobile) {
        setSidebarOpen(false);
      } else if (tablet) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(true);
      }
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    // Lock body scroll and prevent page panning on all devices
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${window.scrollY}px`;
    
    return () => {
      window.removeEventListener('resize', checkScreenSize);
      // Restore body scroll when component unmounts
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    };
  }, []);

  // Auth state & initialize user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        router.push('/login');
      } else {
        setUser(u);
        await initializeUserInFirestore(u);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Load users map
  useEffect(() => {
    if (!user) return;
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const uMap: any = {};
      snap.docs.forEach(d => uMap[d.id] = d.data());
      setUsersMap(uMap);
    });
    return () => unsubUsers();
  }, [user]);

  // Load chat rooms
  useEffect(() => {
    if (!user) return;
    
    let unsubscribe: (() => void) | undefined;
    
    const setupChatListener = async () => {
      await initializeUserInFirestore(user);
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        setChatRooms([]);
        return;
      }
      const userData = userSnap.data() as UserProfile;
      const friendsList = userData.friends || [];
      
      const q = query(
        collection(db, 'chats'), 
        where('participants', 'array-contains', user.uid),
        orderBy('updatedAt', 'desc')
      );
      
      unsubscribe = onSnapshot(q, (snap) => {
        const rooms = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ChatRoom[];
        const activeRooms = rooms.filter(room => {
          const friendId = room.participants.find(p => p !== user.uid);
          return friendId && friendsList.includes(friendId);
        });
        setChatRooms(activeRooms);
      });
    };
    
    setupChatListener();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, refreshKey]);

  // Load messages for active chat
  useEffect(() => {
    if (!activeChat || !user) return;
    
    const checkChatAccess = async () => {
      const friendId = activeChat.participants.find(p => p !== user.uid);
      if (!friendId) return false;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) return false;
      const userData = userSnap.data() as UserProfile;
      
      if (!userData.friends?.includes(friendId)) {
        setActiveChat(null);
        alert('Anda tidak bisa mengakses chat ini karena tidak lagi berteman');
        return false;
      }
      return true;
    };
    
    checkChatAccess();
    
    const q = query(collection(db, `chats/${activeChat.id}/messages`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Message[];
      // Filter out messages deleted for current user
      const visibleMsgs = msgs.filter(msg => !msg.deletedFor?.includes(user.uid));
      setMessages(visibleMsgs);
      
      const unread = snap.docs.filter(d => !d.data().readBy?.includes(user.uid) && d.data().senderId !== user.uid);
      if (unread.length > 0) {
        const batch = writeBatch(db);
        unread.forEach(d => batch.update(d.ref, { readBy: arrayUnion(user.uid) }));
        batch.commit();
      }
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    
    return () => unsubscribe();
  }, [activeChat, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeChat) return;
    
    const friendId = activeChat.participants.find(p => p !== user.uid);
    if (friendId) {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        alert('Data user tidak ditemukan');
        return;
      }
      const userData = userSnap.data() as UserProfile;
      
      if (!userData.friends?.includes(friendId)) {
        alert('Anda tidak bisa mengirim pesan karena tidak lagi berteman');
        setActiveChat(null);
        return;
      }
    }
    
    const messageData: any = {
      text: newMessage, 
      senderId: user.uid, 
      readBy: [user.uid], 
      likedBy: [], 
      createdAt: serverTimestamp()
    };
    
    // Add reply information if replying to a message
    if (replyToMessage) {
      messageData.replyTo = {
        messageId: replyToMessage.id,
        text: replyToMessage.text.substring(0, 100),
        senderName: usersMap[replyToMessage.senderId]?.displayName || 'User',
        senderId: replyToMessage.senderId
      };
    }
    
    const txt = newMessage;
    setNewMessage('');
    setReplyToMessage(null);
    
    try {
      await addDoc(collection(db, `chats/${activeChat.id}/messages`), messageData);
      await updateDoc(doc(db, 'chats', activeChat.id), { 
        updatedAt: serverTimestamp(), 
        lastMessage: txt 
      });
    } catch (err) {
      console.error("Gagal kirim pesan:", err);
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!activeChat || !user) return;
    try {
      const messageRef = doc(db, `chats/${activeChat.id}/messages`, messageId);
      await updateDoc(messageRef, {
        text: newText,
        editedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error editing message:', error);
      alert('Gagal mengedit pesan');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeChat || !user) return;
    try {
      const messageRef = doc(db, `chats/${activeChat.id}/messages`, messageId);
      await updateDoc(messageRef, {
        deletedFor: arrayUnion(user.uid),
        text: 'Pesan telah dihapus',
        isDeleted: true
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Gagal menghapus pesan');
    }
  };

  const handleReplyToMessage = (message: Message) => {
    setReplyToMessage(message);
    setTimeout(() => {
      const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
      }
    }, 100);
  };

  const getFriendData = (participants: string[]) => {
    const friendUid = participants.find(p => p !== user?.uid);
    return usersMap[friendUid || ''] || null;
  };

  const formatTimeLocal = (timestamp: any) => {
    if (!timestamp?.seconds) return '';
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return `${minutes} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    return `${days} hari lalu`;
  };

  const formatTimeChat = (timestamp: any) => {
    if (!timestamp?.seconds) return '';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const openSharedPost = (postId: string) => {
    setSelectedPost({ postId });
  };

  const handleFriendRequestResponded = () => {
    setRefreshKey(prev => prev + 1);
  };

  const totalFriends = Object.values(usersMap).filter(u => u.friends?.includes(user?.uid || '')).length;

  // Select chat handler
  const selectChat = (room: ChatRoom) => {
    setActiveChat(room);
    setReplyToMessage(null);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Go back to sidebar on mobile
  const goBackToSidebar = () => {
    if (isMobile) {
      setSidebarOpen(true);
      setActiveChat(null);
      setReplyToMessage(null);
    }
  };

  // Get active friend data
  const activeFriend = activeChat ? getFriendData(activeChat.participants) : null;

  // Open message action modal
  const openMessageAction = (msg: Message) => {
    setMessageAction({ open: true, message: msg });
  };

  // Cancel reply
  const cancelReply = () => {
    setReplyToMessage(null);
  };

  // Calculate sidebar width based on device
  const getSidebarWidth = () => {
    if (isMobile) return '100%';
    if (isTablet) return '320px';
    return '360px';
  };

  const sidebarWidth = getSidebarWidth();

  return (
    <div 
      ref={mainContainerRef}
      style={{ 
        display: 'flex',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        marginTop: '60px',
        backgroundColor: '#f0f2f5',
        fontFamily: 'sans-serif',
        overflow: 'hidden',
        touchAction: 'pan-y pinch-zoom',
      }}
    >
      
      {/* SIDEBAR - Daftar Obrolan */}
      <div style={{ 
        width: sidebarOpen ? sidebarWidth : '0',
        backgroundColor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isMobile && sidebarOpen ? '0 0 20px rgba(0,0,0,0.15)' : 'none',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 20,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        opacity: sidebarOpen ? 1 : 0,
        visibility: sidebarOpen ? 'visible' : 'hidden',
      }}>
        {/* Header Sidebar */}
        <div style={{ 
          padding: '20px 20px 16px', 
          borderBottom: '1px solid #f0f0f0', 
          background: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 700, background: 'linear-gradient(135deg, #4285F4, #34a853)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Obrolan
            </h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <FriendRequestNotifications 
                currentUser={user!} 
                usersMap={usersMap} 
                onRequestResponded={handleFriendRequestResponded}
              />
              <button 
                onClick={() => setShowFriendsListModal(true)}
                style={{ 
                  background: 'linear-gradient(135deg, #34a853, #2e7d32)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '30px', 
                  padding: isMobile ? '6px 10px' : '8px 14px', 
                  cursor: 'pointer', 
                  fontSize: isMobile ? '11px' : '13px', 
                  fontWeight: 600, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <FontAwesomeIcon icon={faUsers} style={{ fontSize: isMobile ? '12px' : '14px' }} /> 
                <span>{totalFriends}</span>
              </button>
              <button 
                onClick={() => setShowAddFriendModal(true)}
                style={{ 
                  background: 'linear-gradient(135deg, #4285F4, #1a73e8)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '30px', 
                  padding: isMobile ? '6px 10px' : '8px 14px', 
                  cursor: 'pointer', 
                  fontSize: isMobile ? '11px' : '13px', 
                  fontWeight: 600, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <FontAwesomeIcon icon={faUserPlus} style={{ fontSize: isMobile ? '12px' : '14px' }} /> 
                <span style={{ display: isMobile ? 'none' : 'inline' }}>Tambah</span>
              </button>
            </div>
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: '#666', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            paddingTop: '8px'
          }}>
            <FontAwesomeIcon icon={faUserFriends} style={{ fontSize: '11px', color: '#4285F4' }} />
            <span>{totalFriends} Teman</span>
          </div>
        </div>
        
        {/* List Chat */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {chatRooms.length > 0 ? (
            chatRooms.map(room => {
              const friend = getFriendData(room.participants);
              return (
                <div 
                  key={room.id} 
                  onClick={() => selectChat(room)} 
                  style={{ 
                    padding: isMobile ? '12px 16px' : '14px 20px', 
                    cursor: 'pointer', 
                    backgroundColor: activeChat?.id === room.id ? '#f0f7ff' : 'transparent',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: isMobile ? '10px' : '14px', 
                    transition: 'all 0.2s ease',
                    margin: '4px 12px',
                    borderRadius: '16px'
                  }}
                  onMouseEnter={(e) => { if (activeChat?.id !== room.id) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                  onMouseLeave={(e) => { if (activeChat?.id !== room.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ 
                      width: isMobile ? '48px' : '52px', 
                      height: isMobile ? '48px' : '52px', 
                      borderRadius: '50%', 
                      background: 'linear-gradient(135deg, #4285F4, #1a73e8)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: 'white', 
                      fontWeight: 'bold', 
                      fontSize: isMobile ? '18px' : '20px',
                    }}>
                      {friend?.photoURL ? (
                        <img src={friend.photoURL} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt={friend.displayName} />
                      ) : (
                        friend?.displayName?.charAt(0).toUpperCase() || '?'
                      )}
                    </div>
                    <div style={{ 
                      position: 'absolute', 
                      bottom: 2, 
                      right: 2, 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: friend?.status === 'online' ? '#27ae60' : '#95a5a6', 
                      border: '2px solid white',
                    }} />
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 700, fontSize: isMobile ? '14px' : '15px', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {friend?.displayName || 'User'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#aaa', flexShrink: 0, marginLeft: '8px' }}>
                        {room.updatedAt?.seconds ? formatTimeLocal(room.updatedAt) : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {room.lastMessage && room.lastMessage.length > 40 ? room.lastMessage.substring(0, 40) + '...' : room.lastMessage || 'Mulai percakapan...'}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
              <div style={{ 
                width: '70px', 
                height: '70px', 
                background: '#f0f2f5', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 16px' 
              }}>
                <FontAwesomeIcon icon={faComment} style={{ fontSize: '32px', color: '#bbb' }} />
              </div>
              <p style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>Belum ada obrolan</p>
              <p style={{ fontSize: '11px', marginBottom: '16px' }}>Tambahkan teman untuk memulai percakapan</p>
              <button 
                onClick={() => setShowAddFriendModal(true)}
                style={{ 
                  padding: '8px 20px', 
                  background: '#4285F4', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '30px', 
                  cursor: 'pointer', 
                  fontSize: '12px', 
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FontAwesomeIcon icon={faUserPlus} style={{ fontSize: '12px' }} /> Tambah Teman
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CHAT AREA - Area Percakapan */}
      <div style={{ 
        flex: 1,
        backgroundColor: '#fff',
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        marginLeft: sidebarOpen && !isMobile ? sidebarWidth : '0',
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        width: '100%'
      }}>
        {activeChat && activeFriend ? (
          <>
            {/* HEADER CHAT */}
            <div style={{ 
              padding: isMobile ? '10px 16px' : '12px 20px', 
              borderBottom: '1px solid #f0f0f0', 
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                {isMobile && (
                  <button 
                    onClick={goBackToSidebar}
                    style={{ 
                      background: '#f0f2f5', 
                      border: 'none', 
                      cursor: 'pointer', 
                      padding: '8px', 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: '36px',
                      height: '36px',
                      flexShrink: 0
                    }}
                  >
                    <FontAwesomeIcon icon={faArrowLeft} style={{ fontSize: '18px', color: '#4285F4' }} />
                  </button>
                )}
                <div 
                  onClick={() => setShowActionMenu({ open: true, uid: activeFriend.uid, name: activeFriend.displayName })}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1, minWidth: 0 }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ 
                      width: isMobile ? '44px' : '48px', 
                      height: isMobile ? '44px' : '48px', 
                      borderRadius: '50%', 
                      background: 'linear-gradient(135deg, #4285F4, #1a73e8)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: 'white', 
                      fontWeight: 'bold', 
                      fontSize: isMobile ? '16px' : '18px',
                    }}>
                      {activeFriend.photoURL ? (
                        <img src={activeFriend.photoURL} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt={activeFriend.displayName} />
                      ) : (
                        activeFriend.displayName?.charAt(0).toUpperCase() || '?'
                      )}
                    </div>
                    <div style={{ 
                      position: 'absolute', 
                      bottom: 2, 
                      right: 2, 
                      width: '11px', 
                      height: '11px', 
                      borderRadius: '50%', 
                      background: activeFriend.status === 'online' ? '#27ae60' : '#95a5a6', 
                      border: '2px solid white'
                    }} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: isMobile ? '15px' : '16px', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {activeFriend.displayName}
                    </div>
                    <div style={{ fontSize: '11px', color: activeFriend.status === 'online' ? '#27ae60' : '#999', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ 
                        display: 'inline-block', 
                        width: '7px', 
                        height: '7px', 
                        borderRadius: '50%', 
                        background: activeFriend.status === 'online' ? '#27ae60' : '#95a5a6',
                      }} />
                      {activeFriend.status === 'online' ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                <button 
                  onClick={() => router.push(`/dashboard/profile/${activeFriend.uid}`)}
                  style={{ 
                    background: '#f0f2f5', 
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: isMobile ? '7px' : '8px', 
                    borderRadius: '50%',
                    width: isMobile ? '34px' : '38px',
                    height: isMobile ? '34px' : '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Lihat Profil"
                >
                  <FontAwesomeIcon icon={faUser} style={{ fontSize: isMobile ? '14px' : '16px', color: '#555' }} />
                </button>
                <button 
                  onClick={() => setShowActionMenu({ open: true, uid: activeFriend.uid, name: activeFriend.displayName })}
                  style={{ 
                    background: '#f0f2f5', 
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: isMobile ? '7px' : '8px', 
                    borderRadius: '50%',
                    width: isMobile ? '34px' : '38px',
                    height: isMobile ? '34px' : '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Menu"
                >
                  <FontAwesomeIcon icon={faEllipsisV} style={{ fontSize: isMobile ? '14px' : '16px', color: '#555' }} />
                </button>
              </div>
            </div>

            {/* Reply Indicator */}
            {replyToMessage && (
              <div style={{ 
                padding: '8px 16px', 
                backgroundColor: '#e3f2fd', 
                borderLeft: '4px solid #4285F4',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                flexShrink: 0
              }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 'bold', color: '#4285F4' }}>Membalas: </span>
                  <span style={{ color: '#555' }}>{replyToMessage.text.substring(0, 60)}</span>
                </div>
                <button 
                  onClick={cancelReply}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: '14px', padding: '4px', flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* AREA PESAN */}
            <div style={{ 
              flex: 1, 
              padding: isMobile ? '12px 10px' : '20px 20px', 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px', 
              background: '#e5ddd5',
              backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.1) 1%, transparent 1%)',
              backgroundSize: '20px 20px'
            }}>
              {messages.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px', 
                  color: '#aaa',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div style={{ width: '50px', height: '50px', background: 'rgba(255,255,255,0.8)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesomeIcon icon={faComment} style={{ fontSize: '24px', color: '#ccc' }} />
                  </div>
                  <p style={{ fontSize: '13px' }}>Belum ada pesan</p>
                  <p style={{ fontSize: '11px' }}>Mulai percakapan dengan {activeFriend.displayName}</p>
                </div>
              )}
              {messages.map((m, idx) => {
                const isMe = m.senderId === user?.uid;
                const showAvatar = !isMe && (idx === 0 || messages[idx - 1]?.senderId !== m.senderId);
                const isEdited = m.editedAt;
                const isDeletedMsg = m.isDeleted && m.senderId === user?.uid;
                const hasReply = m.replyTo;
                
                return (
                  <div 
                    key={m.id} 
                    style={{ 
                      alignSelf: isMe ? 'flex-end' : 'flex-start', 
                      maxWidth: isMobile ? '85%' : '65%', 
                      display: 'flex', 
                      gap: '6px', 
                      alignItems: 'flex-end',
                      marginBottom: showAvatar && !isMe ? '4px' : '1px'
                    }}
                  >
                    {!isMe && showAvatar && (
                      <div 
                        style={{ 
                          width: '30px', 
                          height: '30px', 
                          borderRadius: '50%', 
                          background: 'linear-gradient(135deg, #4285F4, #1a73e8)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: 'white', 
                          fontSize: '12px', 
                          fontWeight: 'bold', 
                          flexShrink: 0,
                          cursor: 'pointer'
                        }}
                        onClick={() => openMessageAction(m)}
                      >
                        {usersMap[m.senderId]?.photoURL ? (
                          <img src={usersMap[m.senderId].photoURL} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="avatar" />
                        ) : (
                          usersMap[m.senderId]?.displayName?.charAt(0).toUpperCase() || '?'
                        )}
                      </div>
                    )}
                    {!isMe && !showAvatar && <div style={{ width: '30px', flexShrink: 0 }} />}
                    
                    <div 
                      onClick={() => openMessageAction(m)}
                      style={{ 
                        padding: '8px 12px', 
                        borderRadius: '18px', 
                        background: isMe ? '#dcf8c6' : '#fff', 
                        boxShadow: '0 1px 1px rgba(0,0,0,0.08)', 
                        maxWidth: '100%',
                        borderBottomLeftRadius: !isMe && showAvatar ? '4px' : '18px',
                        borderBottomRightRadius: isMe ? '4px' : '18px',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Reply Reference */}
                      {hasReply && !isDeletedMsg && m.replyTo && (
                        <div style={{ 
                          marginBottom: '6px', 
                          padding: '4px 8px', 
                          backgroundColor: isMe ? '#c5e0b4' : '#f0f0f0', 
                          borderRadius: '10px',
                          borderLeft: `2px solid ${isMe ? '#34a853' : '#4285F4'}`,
                          fontSize: '10px',
                          color: '#666'
                        }}>
                          <div style={{ fontWeight: 'bold', color: isMe ? '#2e7d32' : '#4285F4', marginBottom: '2px', fontSize: '9px' }}>
                            Balasan ke {m.replyTo.senderId === user?.uid ? 'Anda' : m.replyTo.senderName}
                          </div>
                          <div style={{ fontStyle: 'italic', fontSize: '10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            "{m.replyTo.text}"
                          </div>
                        </div>
                      )}
                      
                      {m.sharedPost && (
                        <div 
                          onClick={(e) => { e.stopPropagation(); openSharedPost(m.sharedPost!.postId); }}
                          style={{ 
                            marginBottom: m.text ? '6px' : '0', 
                            padding: '8px', 
                            background: '#f0f7ff', 
                            borderRadius: '10px',
                            borderLeft: '2px solid #4285F4',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ fontSize: '9px', color: '#4285F4', fontWeight: 'bold', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            📤 Postingan
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                            <div style={{ width: '35px', height: '35px', borderRadius: '6px', overflow: 'hidden', background: '#e0e0e0', flexShrink: 0 }}>
                              {m.sharedPost.imageUrl && (
                                <img src={m.sharedPost.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="thumbnail" />
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '10px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.sharedPost.description || 'Tidak ada deskripsi'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {!m.sharedPost && (
                        <div style={{ fontSize: '13px', color: isDeletedMsg ? '#999' : '#1a1a1a', lineHeight: '1.4', wordBreak: 'break-word', fontStyle: isDeletedMsg ? 'italic' : 'normal' }}>
                          {m.text}
                        </div>
                      )}
                      
                      {m.sharedPost && m.text && (
                        <div style={{ fontSize: '12px', color: '#555', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #e0e0e0' }}>
                          {m.text}
                        </div>
                      )}
                      
                      <div style={{ 
                        fontSize: '9px', 
                        color: '#999', 
                        textAlign: 'right', 
                        marginTop: '4px', 
                        display: 'flex', 
                        justifyContent: 'flex-end', 
                        alignItems: 'center', 
                        gap: '3px' 
                      }}>
                        <span>{formatTimeChat(m.createdAt)}</span>
                        {isEdited && !isDeletedMsg && (
                          <span style={{ fontSize: '7px', color: '#aaa' }}>(diedit)</span>
                        )}
                        {isMe && (
                          <span style={{ color: m.readBy?.length > 1 ? '#34b7f1' : '#999', fontSize: '10px' }}>
                            {m.readBy?.length > 1 ? <FontAwesomeIcon icon={faCheckDouble} /> : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* FORM KIRIM PESAN */}
            <form onSubmit={handleSendMessage} style={{ 
              padding: isMobile ? '10px 12px' : '12px 20px', 
              display: 'flex', 
              gap: '10px', 
              background: '#fff',
              borderTop: '1px solid #f0f0f0',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <button 
                type="button"
                style={{ 
                  background: '#f0f2f5', 
                  border: 'none', 
                  borderRadius: '50%', 
                  width: isMobile ? '38px' : '40px', 
                  height: isMobile ? '38px' : '40px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <FontAwesomeIcon icon={faPaperclip} style={{ fontSize: isMobile ? '16px' : '18px', color: '#555' }} />
              </button>
              <input 
                type="text" 
                placeholder={replyToMessage ? "Ketik balasan anda..." : "Ketik pesan anda..."} 
                value={newMessage} 
                onChange={e => setNewMessage(e.target.value)} 
                style={{ 
                  flex: 1, 
                  padding: isMobile ? '10px 14px' : '12px 18px', 
                  borderRadius: '28px', 
                  border: '1px solid #e0e0e0', 
                  outline: 'none', 
                  fontSize: isMobile ? '13px' : '15px',
                  minWidth: 0
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#4285F4'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(66,133,244,0.1)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                style={{ 
                  width: isMobile ? '40px' : '44px', 
                  height: isMobile ? '40px' : '44px', 
                  background: newMessage.trim() ? 'linear-gradient(135deg, #4285F4, #1a73e8)' : '#e0e0e0', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                  flexShrink: 0
                }}
              >
                <FontAwesomeIcon icon={faPaperPlane} style={{ fontSize: isMobile ? '14px' : '16px' }} />
              </button>
            </form>
          </>
        ) : (
          // Empty state ketika belum ada chat yang dipilih
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center', 
            color: '#bbb', 
            padding: '20px', 
            textAlign: 'center',
            background: '#fff'
          }}>
            <div style={{ 
              width: isMobile ? '80px' : '100px', 
              height: isMobile ? '80px' : '100px', 
              background: '#f5f5f5', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              <FontAwesomeIcon icon={faComment} style={{ fontSize: isMobile ? '36px' : '44px', color: '#4285F4' }} />
            </div>
            <h3 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>Pilih Obrolan</h3>
            <p style={{ fontSize: '12px', color: '#888', maxWidth: '250px', marginBottom: '20px' }}>
              Pilih percakapan dari daftar di samping untuk mulai berkirim pesan
            </p>
            {isMobile && (
              <button 
                onClick={() => setSidebarOpen(true)}
                style={{ 
                  padding: '10px 24px', 
                  background: '#4285F4', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '30px', 
                  cursor: 'pointer', 
                  fontSize: '13px', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FontAwesomeIcon icon={faBars} /> Buka Daftar Obrolan
              </button>
            )}
          </div>
        )}
      </div>

      {/* Overlay untuk mobile saat sidebar terbuka */}
      {isMobile && sidebarOpen && activeChat === null && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.3)', 
            zIndex: 15,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Action Menu Modal for Friend */}
      {showActionMenu.open && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0,0,0,0.5)', 
          backdropFilter: 'blur(5px)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          zIndex: 3000, 
          padding: '16px' 
        }}>
          <div style={{ 
            background: '#fff', 
            width: 'min(320px, calc(100vw - 32px))', 
            borderRadius: '28px', 
            overflow: 'hidden', 
            textAlign: 'center', 
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          }}>
            <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ 
                width: '60px', 
                height: '60px', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #4285F4, #1a73e8)', 
                color: '#fff', 
                margin: '0 auto 12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '24px', 
                fontWeight: 'bold',
              }}>
                {showActionMenu.name.charAt(0).toUpperCase()}
              </div>
              <strong style={{ fontSize: '16px', color: '#1a1a1a' }}>{showActionMenu.name}</strong>
            </div>
            <div 
              onClick={() => { 
                router.push(`/dashboard/profile/${showActionMenu.uid}`); 
                setShowActionMenu({ ...showActionMenu, open: false }); 
              }} 
              style={{ 
                padding: '14px', 
                cursor: 'pointer', 
                fontWeight: 500, 
                borderBottom: '1px solid #f0f0f0', 
                color: '#4285F4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              <FontAwesomeIcon icon={faUser} /> Lihat Profil
            </div>
            <div 
              onClick={() => { 
                router.push(`/dashboard/story/${showActionMenu.uid}`); 
                setShowActionMenu({ ...showActionMenu, open: false }); 
              }} 
              style={{ 
                padding: '14px', 
                cursor: 'pointer', 
                fontWeight: 500, 
                color: '#E91E63',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              <FontAwesomeIcon icon={faClock} /> Lihat Cerita
            </div>
            <div 
              onClick={() => setShowActionMenu({ ...showActionMenu, open: false })} 
              style={{ 
                padding: '14px', 
                cursor: 'pointer', 
                color: '#999', 
                fontSize: '13px',
              }}
            >
              Tutup
            </div>
          </div>
        </div>
      )}

      {/* Message Action Modal */}
      <MessageActionModal
        isOpen={messageAction.open}
        onClose={() => setMessageAction({ open: false, message: null })}
        message={messageAction.message}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onReply={handleReplyToMessage}
      />

      {/* Add Friend Modal */}
      <AddFriendModal 
        isOpen={showAddFriendModal}
        onClose={() => setShowAddFriendModal(false)}
        currentUser={user!}
        onFriendRequestSent={handleFriendRequestResponded}
      />

      {/* Friends List Modal */}
      <FriendsListModal
        isOpen={showFriendsListModal}
        onClose={() => setShowFriendsListModal(false)}
        currentUser={user!}
        usersMap={usersMap}
      />

      {/* Post Popup */}
      {selectedPost && user && (
        <PostPopup 
          postId={selectedPost.postId} 
          currentUser={user} 
          onClose={() => setSelectedPost(null)} 
          usersMap={usersMap}
        />
      )}
    </div>
  );
}
