'use client';

import { useState, useEffect, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { 
  collection, query, where, orderBy, onSnapshot, 
  doc, updateDoc, arrayUnion, arrayRemove, limit, Timestamp,
  addDoc, serverTimestamp, getDoc, getDocs
} from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHeart, faComment, faRetweet, faPaperPlane, faTimes,
  faUser, faClock, faCalendar, faReply, faChevronRight,
  faShare, faPlay, faPaperclip, faArrowLeft
} from '@fortawesome/free-solid-svg-icons';

// Custom Alert Component
const CustomAlert = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const getColor = () => {
    switch (type) {
      case 'success': return '#4caf50';
      case 'error': return '#f44336';
      case 'info': return '#2196f3';
      default: return '#2196f3';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '70px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10000,
      animation: 'slideDown 0.3s ease-out',
      width: 'calc(100% - 40px)',
      maxWidth: '400px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        padding: '14px 18px',
        borderLeft: `4px solid ${getColor()}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '20px' }}>{type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span style={{ flex: 1, fontSize: '13px', color: '#333' }}>{message}</span>
        <button onClick={onClose} style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#999',
          fontSize: '14px',
          padding: '5px'
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
  mediaType?: 'image' | 'video' | 'youtube' | 'tiktok';
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

interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt: any;
}

const MediaContent = ({ url, mediaType, onClick, style }: { url: string; mediaType?: string; onClick?: () => void; style?: any }) => {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', color: '#999', minHeight: '250px' }}>
        <span style={{ fontSize: '14px' }}>Gagal memuat media</span>
      </div>
    );
  }

  if (mediaType === 'youtube') {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const embedId = (match && match[2].length === 11) ? match[2] : null;
    return (
      <iframe
        src={`https://www.youtube.com/embed/${embedId}`}
        style={{ ...style, border: 'none', minHeight: '250px' }}
        allowFullScreen
      />
    );
  }

  if (mediaType === 'tiktok') {
    const tiktokId = url.split('/video/')[1]?.split('?')[0];
    return (
      <div style={{ ...style, backgroundColor: '#000', position: 'relative', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <iframe
          src={`https://www.tiktok.com/embed/v2/${tiktokId}`}
          style={{ width: '100%', height: '100%', position: 'absolute', border: 'none' }}
          allow="fullscreen"
        />
        {!tiktokId && (
           <a href={url} target="_blank" style={{ color: 'white', textDecoration: 'none', textAlign: 'center', zIndex: 1 }}>
             <FontAwesomeIcon icon={faPlay} size="2x" /><br/>
             <span style={{ fontSize: '12px' }}>Tonton di TikTok</span>
           </a>
        )}
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <video 
        src={url}
        style={style}
        controls
        playsInline
        onError={() => setError(true)}
      />
    );
  }

  return (
    <img 
      src={url}
      style={style}
      onClick={onClick}
      onError={() => setError(true)}
      alt="Feed"
    />
  );
};

export default function Beranda() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [usersMap, setUsersMap] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [isReposting, setIsReposting] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showActionMenu, setShowActionMenu] = useState<{ open: boolean, uid: string, name: string, photoURL?: string }>({ 
    open: false, uid: '', name: '' 
  });
  
  const [showShareModal, setShowShareModal] = useState<{ open: boolean; post: Post | null }>({ open: false, post: null });
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  
  const commentInputRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const showAlert = (message: string, type: 'success' | 'error' | 'info') => {
    setAlert({ message, type });
  };

  useEffect(() => {
    if (replyTo && commentInputRef.current) {
      commentInputRef.current.focus();
    }
  }, [replyTo]);

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  // 1. Monitor Auth State
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (!u) {
        router.push('/login');
      } else {
        setUser(u);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Sync Semua Data User (Real-time)
  useEffect(() => {
    if (!user) return;
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const uMap: any = {};
      snap.docs.forEach(d => uMap[d.id] = d.data());
      setUsersMap(uMap);
    });
    return () => unsubUsers();
  }, [user]);

  // 3. Load Stories Aktif
  useEffect(() => {
    if (!user) return;
    const now = Timestamp.now();
    const q = query(
      collection(db, 'stories'),
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      const storyList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const uniqueStories = Array.from(new Map(storyList.map(s => [s['userId'], s])).values());
      setStories(uniqueStories);
    });
  }, [user]);

  // 4. Load Postingan Feed
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'posts'),
      where('isArchived', '==', false),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, (snap) => {
      const postsData = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Post[];
      const enrichedPosts = postsData.map(post => ({
        ...post,
        userPhotoURL: usersMap[post.userId]?.photoURL,
        mediaType: post.mediaType || (post.imageUrl?.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image')
      }));
      setPosts(enrichedPosts);
    });
  }, [user, usersMap]);

  // 5. Load chat rooms untuk share
  useEffect(() => {
    if (!user || !showShareModal.open) return;
    
    const loadChatRooms = async () => {
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', user.uid),
        orderBy('updatedAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snap) => {
        const rooms = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ChatRoom[];
        setChatRooms(rooms);
      });
      
      return unsubscribe;
    };
    
    loadChatRooms();
  }, [user, showShareModal.open]);

  // 6. Load Comments untuk selected post
  useEffect(() => {
    if (!selectedPost) return;
    const q = query(collection(db, `posts/${selectedPost.id}/comments`), orderBy('createdAt', 'asc'));
    
    return onSnapshot(q, async (snap) => {
      const allComments = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          userPhotoURL: usersMap[data.userId]?.photoURL,
          replies: []
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
          root.replies.sort((a, b) => a.createdAt?.seconds - b.createdAt?.seconds);
        }
      });
      
      setComments(rootComments);
    });
  }, [selectedPost, usersMap]);

  const createNotification = async (
    targetUserId: string,
    type: 'like' | 'comment' | 'share' | 'reply_comment',
    relatedId: string,
    message: string
  ) => {
    if (!user || targetUserId === user.uid) return;
    
    try {
      await addDoc(collection(db, `users/${targetUserId}/notifications`), {
        type: type,
        senderId: user.uid,
        senderName: user.displayName || 'User',
        message: message,
        relatedId: relatedId,
        isRead: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Gagal membuat notifikasi:", err);
    }
  };

  const handleLike = async (post: Post) => {
    if (!user) return;
    const isLiked = post.likedBy?.includes(user.uid);
    
    await updateDoc(doc(db, 'posts', post.id), { 
      likedBy: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid) 
    });
    
    if (!isLiked) {
      await createNotification(post.userId, 'like', post.id, `menyukai postingan Anda`);
      showAlert('Berhasil menyukai postingan!', 'success');
    }
  };

  const handleRepost = async (post: Post) => {
    if (!user || isReposting) return;
    setIsReposting(true);
    
    try {
      const isReposted = post.repostedBy?.includes(user.uid);
      
      await updateDoc(doc(db, 'posts', post.id), { 
        repostedBy: isReposted ? arrayRemove(user.uid) : arrayUnion(user.uid) 
      });
      
      if (!isReposted) {
        await createNotification(post.userId, 'share', post.id, `membagikan ulang postingan Anda`);
        showAlert('Berhasil membagikan ulang!', 'success');
      } else {
        showAlert('Batalkan bagikan ulang', 'info');
      }
    } catch (err) {
      console.error("Gagal repost:", err);
      showAlert('Gagal membagikan ulang', 'error');
    } finally {
      setIsReposting(false);
    }
  };

  const handleShareToChat = (post: Post) => {
    setShowShareModal({ open: true, post });
  };

  const sendPostToChat = async (chatId: string, post: Post) => {
    if (!user || isSharing) return;
    setIsSharing(true);
    
    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);
      const chatData = chatDoc.data();
      
      if (!chatData) {
        showAlert('Chat room tidak ditemukan', 'error');
        return;
      }
      
      const sharedPostData = {
        postId: post.id || '',
        userId: post.userId || '',
        userName: post.userName || 'User',
        userPhotoURL: post.userPhotoURL || null,
        description: post.description || '',
        imageUrl: post.imageUrl || '',
        mediaType: post.mediaType || 'image',
        likedBy: post.likedBy?.length || 0,
        repostedBy: post.repostedBy?.length || 0
      };
      
      const messageData = {
        senderId: user.uid,
        text: `📤 Membagikan postingan: ${post.description?.substring(0, 100) || 'Postingan'}`,
        readBy: [user.uid],
        likedBy: [],
        createdAt: serverTimestamp(),
        sharedPost: sharedPostData,
        type: 'shared_post'
      };
      
      await addDoc(collection(db, `chats/${chatId}/messages`), messageData);
      
      await updateDoc(chatRef, {
        updatedAt: serverTimestamp(),
        lastMessage: `📤 Membagikan postingan: ${post.description?.substring(0, 50) || 'Postingan'}`
      });
      
      const receiverId = chatData.participants.find((p: string) => p !== user.uid);
      if (receiverId) {
        await createNotification(
          receiverId,
          'share',
          post.id,
          `membagikan postingan kepada Anda di chat`
        );
      }
      
      showAlert('Postingan berhasil dibagikan ke chat!', 'success');
      setShowShareModal({ open: false, post: null });
    } catch (err) {
      console.error("Gagal share ke chat:", err);
      showAlert('Gagal membagikan postingan', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || !selectedPost || !user) return;
    
    try {
      const commentData: any = {
        userId: user.uid,
        userName: user.displayName || 'User',
        userPhotoURL: user.photoURL || null,
        text: comment,
        createdAt: serverTimestamp()
      };
      
      if (replyTo) {
        commentData.replyTo = replyTo.id;
        commentData.replyToUserName = replyTo.userName;
      }
      
      await addDoc(collection(db, `posts/${selectedPost.id}/comments`), commentData);
      
      await createNotification(
        selectedPost.userId,
        'comment',
        selectedPost.id,
        `memberi komentar: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"`
      );
      
      if (replyTo && replyTo.userId !== user.uid) {
        await createNotification(
          replyTo.userId,
          'reply_comment',
          selectedPost.id,
          `membalas komentar Anda: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"`
        );
      }
      
      setComment('');
      setReplyTo(null);
      showAlert(replyTo ? 'Balasan terkirim!' : 'Komentar terkirim!', 'success');
    } catch (err) {
      console.error("Gagal menambah komentar:", err);
      showAlert('Gagal mengirim komentar', 'error');
    }
  };

  const viewStory = (userId: string) => {
    router.push(`/dashboard/story/${userId}`);
  };

  const formatTime = (timestamp: any) => {
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

  const renderComment = (comment: Comment, depth: number = 0) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    const maxDepth = 3;
    
    return (
      <div key={comment.id} style={{ marginLeft: depth > 0 ? '12%' : '0', marginBottom: '16px' }}>
        <div style={{ 
          backgroundColor: depth > 0 ? '#f8f9fa' : 'transparent',
          padding: depth > 0 ? '12px' : '0',
          borderRadius: depth > 0 ? '16px' : '0',
          borderLeft: depth > 0 ? '3px solid #4285F4' : 'none'
        }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', flexShrink: 0 }}>
              {comment.userPhotoURL ? (
                <img 
                  src={comment.userPhotoURL} 
                  alt={comment.userName} 
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
              <div style={{ 
                width: '100%', height: '100%', borderRadius: '50%', 
                background: 'linear-gradient(45deg, #4285F4, #34a853)', 
                display: comment.userPhotoURL ? 'none' : 'flex',
                alignItems: 'center', justifyContent: 'center', 
                color: 'white', fontSize: '14px', fontWeight: 'bold'
              }}>
                {comment.userName?.charAt(0).toUpperCase()}
              </div>
            </div>
            
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <span style={{ fontWeight: 'bold', color: '#4285F4', fontSize: '14px' }}>{comment.userName}</span>
                {comment.replyTo && (
                  <span style={{ fontSize: '11px', color: '#888' }}>
                    → membalas <strong>{comment.replyToUserName}</strong>
                  </span>
                )}
                <span style={{ fontSize: '10px', color: '#aaa' }}>• {formatTime(comment.createdAt)}</span>
              </div>
              <p style={{ margin: '6px 0 8px', fontSize: '14px', color: '#333', lineHeight: '1.5' }}>{comment.text}</p>
              <button 
                onClick={() => setReplyTo(comment)}
                style={{ background: 'none', border: 'none', fontSize: '12px', color: '#4285F4', cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FontAwesomeIcon icon={faReply} style={{ fontSize: '11px' }} /> Balas
              </button>
            </div>
          </div>
        </div>
        
        {hasReplies && isExpanded && depth < maxDepth && (
          <div style={{ marginTop: '12px', paddingLeft: '16px', borderLeft: '2px dashed #e0e0e0', marginLeft: '12px' }}>
            {comment.replies!.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
        
        {hasReplies && !isExpanded && depth < maxDepth && (
          <div onClick={() => toggleReplies(comment.id)} style={{ marginTop: '8px', marginLeft: '48px', padding: '8px 12px', backgroundColor: '#f5f5f5', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', color: '#666', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <FontAwesomeIcon icon={faComment} style={{ fontSize: '11px' }} />
            <span>{comment.replies!.length} balasan</span>
            <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: '10px' }} />
          </div>
        )}
      </div>
    );
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#888' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⌛</div>
        <div>Memuat Beranda...</div>
      </div>
    </div>
  );

  return (
    <>
      <div style={{ 
        maxWidth: '600px', 
        margin: '0 auto', 
        padding: '12px 12px 80px',
        // IMPORTANT: Add padding-top untuk menghindari navbar mobile (64px = 4rem)
        paddingTop: '76px', // 64px + 12px untuk safe margin
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', 
        backgroundColor: 'tranparent', 
        minHeight: '100vh' 
      }}>
        {alert && <CustomAlert message={alert.message} type={alert.type} onClose={() => setAlert(null)} />}
        
        {/* SECTION 1: STORY ROW */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          overflowX: 'auto', 
          padding: '12px 8px', 
          backgroundColor: 'white', 
          borderRadius: '20px', 
          border: '1px solid #eee',
          marginBottom: '16px',
          WebkitOverflowScrolling: 'touch'
        }} className="story-scroll">
          <div onClick={() => router.push('/dashboard/upload')} style={{ textAlign: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: '2px dashed #bbb', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px', marginBottom: '4px', backgroundColor: '#f9f9f9', color: '#aaa' }}>
              ➕
            </div>
            <div style={{ fontSize: '11px', color: '#888', fontWeight: '500' }}>Cerita</div>
          </div>

          {stories.slice(0, 10).map((s) => {
            const isSeen = s.viewers?.some((v: any) => v.uid === user?.uid);
            return (
              <div key={s.id} onClick={() => viewStory(s.userId)} style={{ textAlign: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ 
                  width: '64px', height: '64px', borderRadius: '50%', padding: '2px',
                  background: isSeen ? '#e0e0e0' : 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                  marginBottom: '4px'
                }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid white', overflow: 'hidden', backgroundColor: '#eee', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {usersMap[s.userId]?.photoURL ? (
                      <img 
                        src={usersMap[s.userId].photoURL} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isSeen ? 'grayscale(0.6)' : 'none' }} 
                        alt={s.userName}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: '#999', fontSize: '20px' }}>{s.userName?.charAt(0).toUpperCase()}</div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '10px', color: isSeen ? '#999' : '#333', fontWeight: isSeen ? 'normal' : '500', maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.userName?.length > 10 ? s.userName.substring(0, 10) + '...' : s.userName}
                </div>
              </div>
            );
          })}
        </div>

        {/* SECTION 2: FEED */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {posts.map((post) => (
            <div key={post.id} style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #efefef', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div 
                  onClick={() => {
                    if (post.userId === user?.uid) router.push('/dashboard/profile');
                    else setShowActionMenu({ open: true, uid: post.userId, name: post.userName, photoURL: post.userPhotoURL });
                  }}
                  style={{ width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#4285F4', flexShrink: 0 }}
                >
                  {post.userPhotoURL ? (
                    <img 
                      src={post.userPhotoURL} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      alt={post.userName}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', fontSize: '16px' }}>{post.userName?.charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <span onClick={() => {
                    if (post.userId === user?.uid) router.push('/dashboard/profile');
                    else setShowActionMenu({ open: true, uid: post.userId, name: post.userName, photoURL: post.userPhotoURL });
                  }} style={{ fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>{post.userName}</span>
                  <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>
                    {formatTime(post.createdAt)}
                  </div>
                </div>
              </div>

              <div onClick={() => setSelectedPost(post)} style={{ cursor: 'pointer' }}>
                <MediaContent 
                  url={post.imageUrl} 
                  mediaType={post.mediaType}
                  style={{ width: '100%', maxHeight: '500px', objectFit: 'cover' }}
                />
              </div>

              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
                  <button onClick={() => handleLike(post)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: 0, color: post.likedBy?.includes(user?.uid) ? '#ff4444' : '#666' }}>
                    <FontAwesomeIcon icon={faHeart} />
                  </button>
                  <button onClick={() => setSelectedPost(post)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: 0, color: '#666' }}>
                    <FontAwesomeIcon icon={faComment} />
                  </button>
                  <button onClick={() => handleRepost(post)} disabled={isReposting} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: 0, color: post.repostedBy?.includes(user?.uid) ? '#4caf50' : '#666', opacity: isReposting ? 0.5 : 1 }}>
                    <FontAwesomeIcon icon={faRetweet} spin={isReposting} />
                  </button>
                  <button onClick={() => handleShareToChat(post)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: 0, color: '#666' }}>
                    <FontAwesomeIcon icon={faShare} />
                  </button>
                </div>
                
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>{post.likedBy?.length || 0} suka</div>
                <div style={{ fontSize: '14px', color: '#444', lineHeight: '1.4' }}>
                  <span style={{ fontWeight: 'bold', marginRight: '8px' }}>{post.userName}</span>
                  <span>{post.description}</span>
                </div>
                <div onClick={() => setSelectedPost(post)} style={{ fontSize: '12px', color: '#aaa', marginTop: '8px', cursor: 'pointer' }}>
                  Lihat semua komentar...
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* MODAL SHARE KE CHAT */}
        {showShareModal.open && showShareModal.post && (
          <div style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.7)', 
            backdropFilter: 'blur(8px)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'flex-end',
            zIndex: 2000
          }}>
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '28px 28px 0 0', 
              width: '100%', 
              maxWidth: '500px', 
              maxHeight: '85vh', 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden', 
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
              animation: 'slideUp 0.3s ease-out'
            }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Bagikan ke Chat</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#888' }}>Pilih obrolan untuk membagikan postingan</p>
                </div>
                <button onClick={() => setShowShareModal({ open: false, post: null })} style={{ background: '#f5f5f5', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FontAwesomeIcon icon={faTimes} style={{ color: '#666', fontSize: '16px' }} />
                </button>
              </div>
              
              <div style={{ padding: '12px', backgroundColor: '#f8f9fa', margin: '12px', borderRadius: '16px', border: '1px solid #e5e5e5' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#e0e0e0', flexShrink: 0 }}>
                    {showShareModal.post.imageUrl && (
                      <img src={showShareModal.post.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="preview" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '2px' }}>{showShareModal.post.userName}</div>
                    <div style={{ fontSize: '12px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {showShareModal.post.description?.substring(0, 50) || 'Tidak ada deskripsi'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
                {chatRooms.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
                    <FontAwesomeIcon icon={faComment} style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }} />
                    <p style={{ fontSize: '14px' }}>Belum ada obrolan</p>
                    <button onClick={() => router.push('/dashboard/chat')} style={{ marginTop: '12px', padding: '10px 20px', background: '#4285F4', color: 'white', border: 'none', borderRadius: '25px', cursor: 'pointer', fontSize: '14px' }}>
                      Mulai Chat
                    </button>
                  </div>
                ) : (
                  chatRooms.map((room) => {
                    const friendId = room.participants.find(p => p !== user?.uid);
                    const friend = usersMap[friendId || ''];
                    if (!friend) return null;
                    
                    return (
                      <div 
                        key={room.id}
                        onClick={() => sendPostToChat(room.id, showShareModal.post!)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          marginBottom: '8px',
                          borderRadius: '16px',
                          cursor: 'pointer',
                          backgroundColor: '#fff',
                          border: '1px solid #f0f0f0'
                        }}
                      >
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {friend.photoURL ? (
                            <img src={friend.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={friend.displayName} />
                          ) : (
                            <span style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>{friend.displayName?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '2px' }}>{friend.displayName}</div>
                          <div style={{ fontSize: '11px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {room.lastMessage?.substring(0, 40) || 'Kirim pesan...'}
                          </div>
                        </div>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FontAwesomeIcon icon={faPaperPlane} style={{ color: '#4285F4', fontSize: '16px' }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL POST DETAIL - FULLSCREEN RESPONSIVE */}
        {selectedPost && (
          <div style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'white', 
            display: 'flex', 
            flexDirection: 'column',
            zIndex: 1000
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid #efefef',
              backgroundColor: 'white',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <button onClick={() => {
                setSelectedPost(null);
                setReplyTo(null);
                setComment('');
              }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center' }}>
                <FontAwesomeIcon icon={faArrowLeft} style={{ color: '#333' }} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selectedPost.userPhotoURL ? (
                    <img src={selectedPost.userPhotoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  ) : (
                    <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>{selectedPost.userName?.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{selectedPost.userName}</span>
              </div>
              <div style={{ width: '40px' }} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              <div style={{ borderRadius: '16px', overflow: 'hidden', backgroundColor: '#000', marginBottom: '16px' }}>
                <MediaContent 
                  url={selectedPost.imageUrl} 
                  mediaType={selectedPost.mediaType}
                  style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }}
                />
              </div>
              
              <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#333', marginBottom: '20px' }}>{selectedPost.description}</p>
              
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #efefef' }}>
                <button onClick={() => handleLike(selectedPost)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: selectedPost.likedBy?.includes(user?.uid) ? '#ff4444' : '#666' }}>
                  <FontAwesomeIcon icon={faHeart} />
                  <span style={{ fontSize: '13px' }}>{selectedPost.likedBy?.length || 0}</span>
                </button>
                <button style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#666' }}>
                  <FontAwesomeIcon icon={faComment} />
                  <span style={{ fontSize: '13px' }}>{comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)}</span>
                </button>
              </div>

              <div>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#666', fontWeight: '600' }}>
                  Komentar ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})
                </h4>
                
                {replyTo && (
                  <div style={{ 
                    backgroundColor: '#e3f2fd', 
                    padding: '10px 14px', 
                    borderRadius: '12px', 
                    marginBottom: '16px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    fontSize: '12px' 
                  }}>
                    <span style={{ flex: 1 }}>
                      <FontAwesomeIcon icon={faReply} style={{ marginRight: '8px', fontSize: '10px' }} /> 
                      Membalas <strong>{replyTo.userName}</strong>
                    </span>
                    <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: '4px' }}>
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                )}
                
                <div style={{ maxHeight: 'calc(100vh - 500px)', overflowY: 'auto', marginBottom: '16px' }}>
                  {comments.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#aaa', padding: '30px', fontSize: '13px' }}>Belum ada komentar. Jadilah yang pertama!</p>
                  ) : (
                    comments.map(comment => renderComment(comment))
                  )}
                  <div ref={commentsEndRef} />
                </div>
              </div>
            </div>

            <div style={{ 
              borderTop: '1px solid #efefef', 
              padding: '12px 16px',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
              backgroundColor: 'white',
              position: 'sticky',
              bottom: 0
            }}>
              <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ width: '36px', height: '36px', flexShrink: 0 }}>
                  {user?.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName} 
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div style={{ 
                    width: '100%', height: '100%', borderRadius: '50%', 
                    background: 'linear-gradient(45deg, #4285F4, #34a853)', 
                    display: user?.photoURL ? 'none' : 'flex',
                    alignItems: 'center', justifyContent: 'center', 
                    color: 'white', fontSize: '14px', fontWeight: 'bold'
                  }}>
                    {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </div>
                <input 
                  ref={commentInputRef}
                  type="text" 
                  placeholder={replyTo ? `Balas ke ${replyTo.userName}...` : "Tulis komentar..."} 
                  value={comment} 
                  onChange={(e) => setComment(e.target.value)} 
                  style={{ 
                    flex: 1, 
                    padding: '12px 16px', 
                    borderRadius: '25px', 
                    border: '1px solid #e0e0e0', 
                    background: '#f8f9fa', 
                    outline: 'none', 
                    fontSize: '15px',
                    fontFamily: 'inherit'
                  }} 
                />
                <button 
                  type="submit" 
                  disabled={!comment.trim()} 
                  style={{ 
                    padding: '10px 20px', 
                    background: comment.trim() ? '#4285F4' : '#ccc', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '25px', 
                    fontWeight: 'bold', 
                    cursor: comment.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    whiteSpace: 'nowrap'
                  }}>
                  <FontAwesomeIcon icon={faPaperPlane} style={{ marginRight: '6px' }} />
                  {replyTo ? 'Balas' : 'Kirim'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ACTION MENU MODAL */}
        {showActionMenu.open && (
          <div style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.5)', 
            backdropFilter: 'blur(4px)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'flex-end',
            zIndex: 3000
          }}>
            <div style={{ 
              background: '#fff', 
              width: '100%', 
              maxWidth: '500px', 
              borderRadius: '28px 28px 0 0', 
              overflow: 'hidden', 
              textAlign: 'center', 
              boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
              animation: 'slideUp 0.3s ease-out'
            }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 12px', overflow: 'hidden', position: 'relative', backgroundColor: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showActionMenu.photoURL ? (
                    <img 
                      src={showActionMenu.photoURL} 
                      alt={showActionMenu.name} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>{showActionMenu.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <strong style={{ fontSize: '17px' }}>{showActionMenu.name}</strong>
              </div>
              <div onClick={() => { router.push(`/dashboard/profile/${showActionMenu.uid}`); setShowActionMenu({ ...showActionMenu, open: false }); }} style={{ padding: '16px', cursor: 'pointer', fontWeight: '500', borderBottom: '1px solid #f0f0f0', color: '#333', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', fontSize: '15px' }}>
                <FontAwesomeIcon icon={faUser} style={{ fontSize: '18px' }} /> Lihat Profil
              </div>
              <div onClick={() => { router.push(`/dashboard/chat?userId=${showActionMenu.uid}`); setShowActionMenu({ ...showActionMenu, open: false }); }} style={{ padding: '16px', cursor: 'pointer', fontWeight: '500', borderBottom: '1px solid #f0f0f0', color: '#333', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', fontSize: '15px' }}>
                <FontAwesomeIcon icon={faComment} style={{ fontSize: '18px' }} /> Kirim Pesan
              </div>
              <div onClick={() => setShowActionMenu({ ...showActionMenu, open: false })} style={{ padding: '16px', cursor: 'pointer', color: '#999', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', marginBottom: '8px' }}>
                <FontAwesomeIcon icon={faTimes} style={{ fontSize: '16px' }} /> Tutup
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Global Styles */}
      <style jsx global>{`
        .story-scroll::-webkit-scrollbar {
          display: none;
        }
        @keyframes slideDown {
          from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @media (max-width: 768px) {
          body {
            background-color: #fafafa;
          }
        }
      `}</style>
    </>
  );
}