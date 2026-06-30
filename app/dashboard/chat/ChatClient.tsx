'use client';

import { useState, useEffect, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { 
  collection, query, where, orderBy, onSnapshot, 
  addDoc, serverTimestamp, doc, updateDoc, writeBatch, 
  arrayUnion, arrayRemove, getDoc, getDocs, setDoc
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHeart, faComment, faPaperPlane, faTimes, faUser,
  faClock, faReply, faChevronRight, faPaperclip, faUserPlus,
  faBell, faCheck, faTimes as faTimesCircle, faUsers, 
  faSearch, faUserFriends, faUserCheck, faClock as faClockIcon,
  faBars, faArrowLeft, faEllipsisV, faCheckDouble
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
  return <img src={url} style={style} onError={() => setError(true)} alt="Konten Lampiran Pesan" />;
};

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
              <img src={comment.userPhotoURL} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt={`Avatar ${comment.userName}`} />
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
      } final {
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
        await updateDoc(postRef, { likedBy: arrayRemove(currentUser.uid) });
        setLikeCount(prev => prev - 1);
      } else {
        await updateDoc(postRef, { likedBy: arrayUnion(currentUser.uid) });
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
    return minutes < 1 ? 'Baru saja' : minutes < 60 ? `${minutes} menit lalu` : hours < 24 ? `${hours} jam lalu` : 'Beberapa hari lalu';
  };

  if (loading) return null;
  if (!post) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px' }} onClick={onClose}>
      <div style={{ backgroundColor: 'white', borderRadius: '28px', maxWidth: '500px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Detail Postingan</h2>
          <button onClick={onClose} aria-label="Tutup popup">✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <MediaContent url={post.imageUrl} mediaType={post.mediaType} style={{ width: '100%', borderRadius: '12px' }} />
          <p style={{ marginTop: '12px', fontSize: '14px' }}>{post.description}</p>
        </div>
      </div>
    </div>
  );
};

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
    if (!searchTerm.trim()) return;
    setLoading(true);
    setError('');
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('displayName', '>=', searchTerm), where('displayName', '<=', searchTerm + '\uf8ff'));
      const querySnapshot = await getDocs(q);
      const results: UserProfile[] = [];
      querySnapshot.forEach(doc => {
        if (doc.id !== currentUser.uid) results.push({ ...doc.data(), uid: doc.id } as UserProfile);
      });
      setSearchResults(results);
    } catch (err) {
      setError('Gagal mencari user');
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '16px', maxWidth: '400px', width: '100%' }}>
        <h3>Tambah Teman</h3>
        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Nama pengguna..." style={{ width: '100%', padding: '8px', margin: '12px 0' }} />
        <button onClick={handleSearch} style={{ width: '100%', padding: '10px', background: '#4285F4', color: 'white', border: 'none', borderRadius: '8px' }}>Cari</button>
        <button onClick={onClose} style={{ width: '100%', padding: '10px', marginTop: '8px', background: '#eee', border: 'none', borderRadius: '8px' }}>Batal</button>
      </div>
    </div>
  );
};

const FriendsListModal = ({ isOpen, onClose, currentUser, usersMap }: { 
  isOpen: boolean; 
  onClose: () => void; 
  currentUser: User;
  usersMap: { [key: string]: UserProfile };
}) => {
  const [friends, setFriends] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const loadFriends = async () => {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const friendIds = userDoc.data().friends || [];
        setFriends(friendIds.map((id: string) => ({ ...usersMap[id], uid: id })).filter((f: any) => f.displayName));
      }
    };
    loadFriends();
  }, [isOpen, currentUser, usersMap]);

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', padding: '24px', borderRadius: '16px', maxWidth: '400px', width: '100%' }}>
        <h3>Daftar Teman</h3>
        <div style={{ maxHeight: '200px', overflowY: 'auto', margin: '12px 0' }}>
          {friends.map(f => <div key={f.uid} style={{ padding: '8px 0' }}>{f.displayName}</div>)}
        </div>
        <button onClick={onClose} style={{ width: '100%', padding: '10px', background: '#eee', border: 'none', borderRadius: '8px' }}>Tutup</button>
      </div>
    </div>
  );
};

const FriendRequestNotifications = ({ currentUser, usersMap, onRequestResponded }: { 
  currentUser: User; 
  usersMap: { [key: string]: UserProfile };
  onRequestResponded: () => void;
}) => {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'friendRequests'), where('toUserId', '==', currentUser.uid), where('status', '==', 'pending'));
    return onSnapshot(q, snap => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })) as FriendRequest[]));
  }, [currentUser]);

  if (requests.length === 0) return null;

  return (
    <button onClick={() => setShowDropdown(!showDropdown)} aria-label="Notifikasi permintaan pertemanan">
      <FontAwesomeIcon icon={faBell} /> ({requests.length})
    </button>
  );
};

const MessageActionModal = ({ isOpen, onClose, message, onEdit, onDelete, onReply }: { 
  isOpen: boolean; 
  onClose: () => void; 
  message: Message | null;
  onEdit: (messageId: string, newText: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onReply: (message: Message) => void;
}) => {
  if (!isOpen || !message) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px' }}>
        <button onClick={() => { onReply(message); onClose(); }}>Bal
