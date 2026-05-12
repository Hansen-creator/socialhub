'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { 
  doc, onSnapshot, updateDoc, collection, addDoc, 
  query, orderBy, deleteDoc, serverTimestamp, setDoc
} from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faArrowLeft, faShareNodes, faTrashAlt, faMapMarkerAlt, 
  faClock, faPlus, faCheckCircle, faPaperPlane, faUserCheck,
  faCalendarDay, faFlag, faHistory
} from '@fortawesome/free-solid-svg-icons';

// Share Modal Component
const ShareTodoModal = ({ isOpen, onClose, currentUser, usersMap, onShare }: any) => {
  if (!isOpen) return null;

  const friends = currentUser?.friends?.map((uid: string) => ({
    uid,
    ...usersMap[uid]
  })).filter((f: any) => f?.displayName) || [];

  return (
    <>
      {isOpen && (
        <div className="modal-overlay" onClick={onClose}>
          <div className="share-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Share with friends</h3>
              <button onClick={onClose} className="close-btn">×</button>
            </div>
            <div className="modal-body">
              {friends.length === 0 ? (
                <div className="empty-friends">
                  <p>No friends to share with yet.</p>
                </div>
              ) : (
                friends.map((friend: any) => (
                  <div key={friend.uid} className="friend-item" onClick={() => onShare(friend.uid)}>
                    <div className="friend-avatar">
                      {friend.photoURL ? (
                        <img src={friend.photoURL} alt={friend.displayName} />
                      ) : (
                        <span>{friend.displayName?.charAt(0) || '?'}</span>
                      )}
                    </div>
                    <div className="friend-info">
                      <span className="friend-name">{friend.displayName}</span>
                      <span className="friend-status">Online</span>
                    </div>
                    <FontAwesomeIcon icon={faPaperPlane} className="send-icon" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .share-modal {
          background: white;
 border-radius: 1.5rem;
          width: 100%;
          max-width: 380px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 35px -8px rgba(0, 0, 0, 0.2);
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #f0f0f0;
        }
        .modal-header h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1a1a2e;
          margin: 0;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #999;
          padding: 0;
          line-height: 1;
        }
        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem 0;
        }
        .friend-item {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 0.875rem 1.5rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .friend-item:hover {
          background: #f8f9fa;
        }
        .friend-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #e9ecef;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: #495057;
          overflow: hidden;
          flex-shrink: 0;
        }
        .friend-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .friend-info {
          flex: 1;
        }
        .friend-name {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #212529;
        }
        .friend-status {
          font-size: 0.7rem;
          color: #86b7fe;
        }
        .send-icon {
          color: #6c757d;
          font-size: 0.875rem;
        }
        .empty-friends {
          text-align: center;
          padding: 2rem;
          color: #adb5bd;
        }
      `}</style>
    </>
  );
};

// Main Component
export default function TodoDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [fullCurrentUser, setFullCurrentUser] = useState<any>(null);
  const [usersMap, setUsersMap] = useState<any>({});
  const [listData, setListData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  const [newTaskText, setNewTaskText] = useState('');
  const [locationLink, setLocationLink] = useState('');
  const [priority, setPriority] = useState('medium');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    onSnapshot(doc(db, 'users', user.uid), (d) => setFullCurrentUser(d.data()));
    onSnapshot(collection(db, 'users'), (snap) => {
      const map: any = {};
      snap.docs.forEach(d => map[d.id] = d.data());
      setUsersMap(map);
    });
  }, [user]);

  useEffect(() => {
    if (!id || !user) return;
    const unsub = onSnapshot(doc(db, 'todo_lists', id as string), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.participants?.includes(user.uid)) {
          setListData(data);
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } else {
        router.push('/dashboard/todo');
      }
    });
    return () => unsub();
  }, [id, user, router]);

  useEffect(() => {
    if (!isAuthorized) return;
    const qTasks = query(collection(db, `todo_lists/${id}/tasks`), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(qTasks, (snap) => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qLogs = query(collection(db, `todo_lists/${id}/history`), orderBy('timestamp', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snap) => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubTasks(); unsubLogs(); };
  }, [id, isAuthorized]);

  const createLog = async (action: string) => {
    await addDoc(collection(db, `todo_lists/${id}/history`), {
      user: user.displayName || 'User',
      action,
      timestamp: serverTimestamp()
    });
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    await addDoc(collection(db, `todo_lists/${id}/tasks`), {
      text: newTaskText,
      completed: false,
      date: selectedDate,
      location: locationLink,
      priority: priority,
      createdBy: user.displayName,
      createdAt: serverTimestamp()
    });
    await createLog(`added task: "${newTaskText}"`);
    setNewTaskText('');
    setLocationLink('');
  };

  const handleShareToFriend = async (friendId: string) => {
    try {
      const chatId = [user.uid, friendId].sort().join('_');
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        text: `📋 Shared Todo List: ${listData.title}`,
        todoId: id,
        senderId: user.uid,
        type: 'shared_todo',
        todoMetadata: {
          title: listData.title,
          taskCount: tasks.length,
          completedCount: tasks.filter(t => t.completed).length
        },
        createdAt: serverTimestamp(),
        readBy: [user.uid]
      });

      await setDoc(doc(db, 'chats', chatId), {
        participants: [user.uid, friendId],
        lastMessage: `Shared todo: ${listData.title}`,
        updatedAt: serverTimestamp(),
        status: 'active'
      }, { merge: true });

      setIsShareModalOpen(false);
    } catch (error) {
      alert("Failed to share todo list.");
    }
  };

  const filteredTasks = tasks.filter(t => t.date === selectedDate);
  const completedCount = filteredTasks.filter(t => t.completed).length;

  if (isAuthorized === false) {
    return (
      <div className="unauthorized">
        <p>Access denied</p>
        <button onClick={() => router.back()}>Go Back</button>
      </div>
    );
  }
  if (!listData) return <div className="loading">Loading...</div>;

  return (
    <div className="todo-detail">
      <div className="container">
        {/* Header with Back Button */}
        <div className="detail-header">
          <button onClick={() => router.back()} className="back-btn">
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Back</span>
          </button>
          <button onClick={() => setIsShareModalOpen(true)} className="share-btn">
            <FontAwesomeIcon icon={faShareNodes} />
            <span>Share</span>
          </button>
        </div>

        {/* List Info */}
        <div className="list-info">
          <h1>{listData.title}</h1>
          <div className="list-stats">
            <span className="stat-badge">
              <FontAwesomeIcon icon={faCheckCircle} />
              {completedCount}/{filteredTasks.length} completed
            </span>
            <span className="stat-badge">
              <FontAwesomeIcon icon={faUserCheck} />
              {listData.participants?.length || 1} members
            </span>
          </div>
        </div>

        {/* Date Filter */}
        <div className="date-filter">
          <label>
            <FontAwesomeIcon icon={faCalendarDay} />
            <span>Filter by date</span>
          </label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
          />
        </div>

        {/* Tasks Section */}
        <div className="tasks-section">
          <div className="tasks-header">
            <h2>Tasks</h2>
            {filteredTasks.length > 0 && (
              <span className="task-count">{filteredTasks.length} items</span>
            )}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="empty-tasks">
              <p>No tasks for this date</p>
            </div>
          ) : (
            <div className="tasks-list">
              {filteredTasks.map(task => (
                <div key={task.id} className={`task-item priority-${task.priority}`}>
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={async () => {
                      await updateDoc(doc(db, `todo_lists/${id}/tasks`, task.id), { completed: !task.completed });
                      await createLog(`${!task.completed ? 'completed' : 'reopened'}: ${task.text}`);
                    }}
                  />
                  <div className="task-content">
                    <span className={task.completed ? 'completed' : ''}>{task.text}</span>
                    <div className="task-meta">
                      {task.location && (
                        <a href={task.location} target="_blank" rel="noopener noreferrer">
                          <FontAwesomeIcon icon={faMapMarkerAlt} /> Location
                        </a>
                      )}
                      <span><FontAwesomeIcon icon={faClock} /> {task.createdBy}</span>
                    </div>
                  </div>
                  <button
                    className="delete-task"
                    onClick={async () => {
                      if (confirm('Delete this task?')) {
                        await deleteDoc(doc(db, `todo_lists/${id}/tasks`, task.id));
                        await createLog(`deleted task: ${task.text}`);
                      }
                    }}
                  >
                    <FontAwesomeIcon icon={faTrashAlt} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Task Form */}
        <form onSubmit={handleAddTask} className="add-task-form">
          <div className="form-row">
            <input
              type="text"
              placeholder="What needs to be done?"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              className="task-input"
            />
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="priority-select">
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
          </div>
          <div className="form-row">
            <input
              type="text"
              placeholder="Location link (optional)"
              value={locationLink}
              onChange={(e) => setLocationLink(e.target.value)}
              className="location-input"
            />
            <button type="submit" className="submit-btn">
              <FontAwesomeIcon icon={faPlus} />
              <span>Add task</span>
            </button>
          </div>
        </form>

        {/* History Section */}
        <div className="history-section">
          <div className="history-header">
            <FontAwesomeIcon icon={faHistory} />
            <h3>Activity history</h3>
          </div>
          <div className="history-list">
            {history.length === 0 ? (
              <p className="empty-history">No activity yet</p>
            ) : (
              history.map(log => (
                <div key={log.id} className="history-item">
                  <div className="history-dot" />
                  <div className="history-content">
                    <p><strong>{log.user}</strong> {log.action}</p>
                    <span className="history-time">
                      {log.timestamp?.toDate().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <ShareTodoModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        currentUser={fullCurrentUser} 
        usersMap={usersMap} 
        onShare={handleShareToFriend} 
      />

      <style jsx>{`
        .todo-detail {
          min-height: 100vh;
          background: #f5f7fb;
          padding: 5rem 1rem 3rem;
        }

        .container {
          max-width: 800px;
          margin: 0 auto;
        }

        /* Header */
        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .back-btn, .share-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          background: white;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .back-btn {
          color: #4b5563;
        }

        .back-btn:hover {
          background: #f3f4f6;
        }

        .share-btn {
          color: #3b82f6;
          border: 1px solid #e2e8f0;
        }

        .share-btn:hover {
          background: #eff6ff;
          border-color: #3b82f6;
        }

        /* List Info */
        .list-info {
          margin-bottom: 2rem;
        }

        .list-info h1 {
          font-size: 1.75rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 0.75rem 0;
          letter-spacing: -0.02em;
        }

        .list-stats {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .stat-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          color: #64748b;
          background: #f1f5f9;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
        }

        .stat-badge svg {
          font-size: 0.7rem;
        }

        /* Date Filter */
        .date-filter {
          background: white;
          border-radius: 1rem;
          padding: 1rem 1.25rem;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          border: 1px solid #eef2f6;
        }

        .date-filter label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #334155;
        }

        .date-filter input {
          padding: 0.5rem 0.75rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
        }

        /* Tasks Section */
        .tasks-section {
          background: white;
          border-radius: 1.25rem;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          border: 1px solid #eef2f6;
        }

        .tasks-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 1.25rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #f0f2f5;
        }

        .tasks-header h2 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
        }

        .task-count {
          font-size: 0.7rem;
          color: #94a3b8;
        }

        .tasks-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .task-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: #fafbfc;
          border-radius: 0.75rem;
          transition: all 0.2s;
          border-left: 3px solid transparent;
        }

        .task-item.priority-high {
          border-left-color: #ef4444;
        }

        .task-item.priority-medium {
          border-left-color: #f59e0b;
        }

        .task-item.priority-low {
          border-left-color: #10b981;
        }

        .task-item input[type="checkbox"] {
          width: 1.125rem;
          height: 1.125rem;
          cursor: pointer;
          accent-color: #3b82f6;
        }

        .task-content {
          flex: 1;
        }

        .task-content span {
          font-size: 0.875rem;
          color: #1e293b;
          display: block;
          margin-bottom: 0.25rem;
        }

        .task-content .completed {
          text-decoration: line-through;
          color: #94a3b8;
        }

        .task-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.7rem;
        }

        .task-meta a, .task-meta span {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          color: #94a3b8;
          text-decoration: none;
        }

        .task-meta a:hover {
          color: #3b82f6;
        }

        .delete-task {
          background: none;
          border: none;
          color: #cbd5e1;
          cursor: pointer;
          padding: 0.25rem;
          transition: color 0.2s;
        }

        .delete-task:hover {
          color: #ef4444;
        }

        .empty-tasks {
          text-align: center;
          padding: 2rem;
          color: #94a3b8;
          font-size: 0.875rem;
        }

        /* Add Task Form */
        .add-task-form {
          background: white;
          border-radius: 1.25rem;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          border: 1px solid #eef2f6;
        }

        .form-row {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .form-row:last-child {
          margin-bottom: 0;
        }

        .task-input, .location-input, .priority-select {
          padding: 0.75rem 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s;
          background: #fafbfc;
        }

        .task-input {
          flex: 2;
        }

        .priority-select {
          flex: 1;
        }

        .location-input {
          flex: 2;
        }

        .task-input:focus, .location-input:focus, .priority-select:focus {
          border-color: #3b82f6;
          background: white;
        }

        .submit-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0 1.25rem;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .submit-btn:hover {
          background: #2563eb;
        }

        /* History Section */
        .history-section {
          background: white;
          border-radius: 1.25rem;
          padding: 1.5rem;
          border: 1px solid #eef2f6;
        }

        .history-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #f0f2f5;
        }

        .history-header svg {
          color: #94a3b8;
          font-size: 0.875rem;
        }

        .history-header h3 {
          font-size: 0.875rem;
          font-weight: 500;
          color: #475569;
          margin: 0;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-height: 240px;
          overflow-y: auto;
        }

        .history-item {
          display: flex;
          gap: 0.75rem;
        }

        .history-dot {
          width: 6px;
          height: 6px;
          background: #cbd5e1;
          border-radius: 50%;
          margin-top: 0.5rem;
        }

        .history-content {
          flex: 1;
        }

        .history-content p {
          font-size: 0.75rem;
          color: #334155;
          margin: 0 0 0.25rem 0;
        }

        .history-time {
          font-size: 0.6rem;
          color: #94a3b8;
        }

        .empty-history {
          font-size: 0.75rem;
          color: #94a3b8;
          text-align: center;
          padding: 1rem;
        }

        /* States */
        .loading, .unauthorized {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
          color: #64748b;
        }

        .unauthorized button {
          margin-left: 1rem;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          border: none;
          background: #3b82f6;
          color: white;
          cursor: pointer;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .todo-detail {
            padding: 4rem 0.75rem 2rem;
          }

          .list-info h1 {
            font-size: 1.5rem;
          }

          .form-row {
            flex-direction: column;
          }

          .submit-btn {
            justify-content: center;
            padding: 0.75rem;
          }

          .tasks-section, .add-task-form, .history-section {
            padding: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
}