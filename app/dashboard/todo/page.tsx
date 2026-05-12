'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faArrowRight, faUsers, faListCheck, faInbox } from '@fortawesome/free-solid-svg-icons';

export default function TodoPage() {
  const [lists, setLists] = useState<any[]>([]);
  const [newListName, setNewListName] = useState('');
  const [user, setUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'todo_lists'),
      where('participants', 'array-contains', user.uid)
    );
    return onSnapshot(q, (snap) => {
      setLists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  const createList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim() || !user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'todo_lists'), {
        title: newListName,
        ownerId: user.uid,
        ownerName: user.displayName || 'User',
        participants: [user.uid],
        createdAt: serverTimestamp(),
      });
      setNewListName('');
      router.push(`/dashboard/todo/${docRef.id}`);
    } catch (error) {
      console.error("Error creating list:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="todo-page">
      <div className="todo-container">
        {/* Header Section */}
        <div className="header-section">
          <div className="title-badge">
          </div>
          <h1>Todo Lists</h1>
          <p className="subtitle">Manage tasks together with your team</p>
        </div>

        {/* Create List Form */}
        <form onSubmit={createList} className="create-form">
          <div className="input-group">
            <input 
              type="text" 
              placeholder="e.g., Design Sprint, Marketing Campaign..."
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              disabled={isSubmitting}
            />
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="loading-dot">•••</span>
              ) : (
                <>
                  <FontAwesomeIcon icon={faPlus} />
                  <span>New List</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Lists Grid */}
        <div className="lists-section">
          {lists.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <FontAwesomeIcon icon={faInbox} />
              </div>
              <h3>No lists yet</h3>
              <p>Create your first todo list to get started</p>
            </div>
          ) : (
            <div className="lists-grid">
              {lists.map(list => (
                <div 
                  key={list.id} 
                  className="list-card"
                  onClick={() => router.push(`/dashboard/todo/${list.id}`)}
                >
                  <div className="card-content">
                    <h3 className="list-title">{list.title}</h3>
                    <div className="list-meta">
                      <FontAwesomeIcon icon={faUsers} />
                      <span>{list.participants?.length || 1} member{list.participants?.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="card-action">
                    <FontAwesomeIcon icon={faArrowRight} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .todo-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%);
          padding: 2rem 1.5rem;
        }

        .todo-container {
          max-width: 900px;
          margin: 0 auto;
        }

        /* Header Styles */
        .header-section {
          margin-bottom: 2.5rem;
        }

        .title-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.75rem;
          border-radius: 2rem;
          font-size: 0.75rem;
          font-weight: 500;
          margin-bottom: 1rem;
        }

        .badge-icon {
          font-size: 0.7rem;
        }

        h1 {
          font-size: 2rem;
          font-weight: 600;
          color: #1a202c;
          margin: 0 0 0.5rem 0;
          letter-spacing: -0.02em;
        }

        .subtitle {
          color: #64748b;
          font-size: 0.875rem;
          margin: 0;
        }

        /* Form Styles */
        .create-form {
          margin-bottom: 2rem;
        }

        .input-group {
          display: flex;
          gap: 0.75rem;
          background: white;
          padding: 0.5rem;
          border-radius: 1rem;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1);
          transition: all 0.2s ease;
        }

        .input-group:focus-within {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        input {
          flex: 1;
          padding: 0.75rem 1rem;
          border: none;
          background: transparent;
          font-size: 0.875rem;
          outline: none;
          color: #1a202c;
        }

        input::placeholder {
          color: #94a3b8;
        }

        button {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1.25rem;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        button:hover:not(:disabled) {
          background: #2563eb;
          transform: translateY(-1px);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-dot {
          letter-spacing: 2px;
        }

        /* Lists Grid */
        .lists-section {
          margin-top: 0.5rem;
        }

        .lists-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }

        .list-card {
          background: white;
          border-radius: 1rem;
          padding: 1.25rem;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.2s ease;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .list-card:hover {
          border-color: #3b82f6;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
          transform: translateY(-2px);
        }

        .card-content {
          flex: 1;
        }

        .list-title {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0 0 0.5rem 0;
          line-height: 1.4;
        }

        .list-meta {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          color: #64748b;
          background: #f8fafc;
          padding: 0.25rem 0.5rem;
          border-radius: 0.5rem;
        }

        .list-meta svg {
          font-size: 0.65rem;
        }

        .card-action {
          color: #cbd5e1;
          transition: all 0.2s ease;
        }

        .list-card:hover .card-action {
          color: #3b82f6;
          transform: translateX(2px);
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 3rem 2rem;
          background: white;
          border-radius: 1rem;
          border: 1px solid #e2e8f0;
        }

        .empty-icon {
          width: 3.5rem;
          height: 3.5rem;
          background: #f1f5f9;
          border-radius: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem auto;
          color: #94a3b8;
          font-size: 1.5rem;
        }

        .empty-state h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #334155;
          margin: 0 0 0.25rem 0;
        }

        .empty-state p {
          font-size: 0.813rem;
          color: #64748b;
          margin: 0;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .todo-page {
            padding: 1.5rem 1rem;
          }

          h1 {
            font-size: 1.5rem;
          }

          .input-group {
            flex-direction: column;
            background: transparent;
            padding: 0;
            gap: 0.75rem;
          }

          input {
            background: white;
            border-radius: 0.75rem;
            padding: 0.875rem 1rem;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          }

          button {
            justify-content: center;
            padding: 0.75rem;
          }

          .lists-grid {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }

          .list-card {
            padding: 1rem;
          }
        }

        @media (min-width: 641px) and (max-width: 768px) {
          .lists-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}