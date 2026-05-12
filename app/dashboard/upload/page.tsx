'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faImage,
  faCamera,
  faFileImage,
  faTimes,
  faClock,
  faUpload,
  faSpinner,
  faCheckCircle,
} from '@fortawesome/free-solid-svg-icons';

export default function UploadPage() {
  const [uploadType, setUploadType] = useState<'post' | 'story'>('post');
  const [description, setDescription] = useState('');
  const [mediaData, setMediaData] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>('image');
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size too large! Maximum 10MB.');
      return;
    }

    if (file.type.startsWith('video/')) {
      alert('Video upload is not available yet. Please upload an image.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG, PNG, etc.)');
      return;
    }

    setFileName(file.name);
    setMediaType('image');

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const result = event.target?.result as string;

      const img = new Image();
      img.src = result;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        const MAX_WIDTH = uploadType === 'story' ? 1080 : 1200;
        const scaleSize = MAX_WIDTH / img.width;
        
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

        const quality = uploadType === 'story' ? 0.8 : 0.7;
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        if (dataUrl.length > 2 * 1024 * 1024) {
          alert('Image too large after compression! Please choose a smaller image.');
          return;
        }

        setMediaData(dataUrl);
      };
    };

    reader.onerror = () => {
      alert('Failed to read file. Please try again.');
    };
  };

  const handlePosting = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!mediaData || !auth.currentUser) {
      alert('Please select a photo first!');
      return;
    }

    if (uploadType === 'post' && !description.trim()) {
      alert('Please add a description for your post!');
      return;
    }

    setIsUploading(true);

    try {
      const payload = {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'User',
        userPhotoURL: auth.currentUser.photoURL || null,
        imageUrl: mediaData,
        mediaType: mediaType,
        createdAt: serverTimestamp(),
      };

      if (uploadType === 'post') {
        await addDoc(collection(db, 'posts'), {
          ...payload,
          description: description.trim(),
          likedBy: [],
          repostedBy: [],
          commentsCount: 0,
          isArchived: false,
        });
      } else {
        await addDoc(collection(db, 'stories'), {
          ...payload,
          description: description.trim() || '',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          viewedBy: [],
        });
      }

      setUploadSuccess(true);
      setTimeout(() => {
        router.push('/dashboard/profile');
      }, 1500);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + (error.message || 'Something went wrong. Please try again.'));
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const handleRemoveMedia = () => {
    setMediaData(null);
    setFileName('');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors mb-6"
          >
          </button>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
            Create New Content
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Share your moment with the world
          </p>
        </div>

        {/* Toggle Post/Story */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1.5 flex gap-1 mb-6">
          <button
            type="button"
            onClick={() => {
              setUploadType('post');
              setMediaData(null);
              setDescription('');
            }}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
              uploadType === 'post'
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Post
          </button>
          <button
            type="button"
            onClick={() => {
              setUploadType('story');
              setMediaData(null);
              setDescription('');
            }}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
              uploadType === 'story'
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Story
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handlePosting}>
          {/* Upload Area */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="relative min-h-[320px] bg-gray-50 flex items-center justify-center">
              {!mediaData ? (
                <label className="flex flex-col items-center justify-center gap-4 p-8 cursor-pointer w-full min-h-[320px] hover:bg-gray-100 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                    <FontAwesomeIcon icon={faImage} className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-700 mb-1">Click to select an image</p>
                    <p className="text-xs text-gray-400">JPG, PNG (max 10MB)</p>
                    <p className="text-xs text-gray-300 mt-2">
                      {uploadType === 'story' ? 'Recommended: 9:16 (1080x1920)' : 'Recommended: 1:1 (1200x1200)'}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </label>
              ) : (
                <div className="relative w-full">
                  <img
                    src={mediaData}
                    alt="Preview"
                    className="w-full max-h-[500px] object-contain"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveMedia}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-all hover:scale-105"
                  >
                    <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                  </button>
                  {fileName && (
                    <div className="absolute bottom-4 left-4 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-2">
                      <FontAwesomeIcon icon={faFileImage} className="w-3 h-3" />
                      <span className="max-w-[200px] truncate">{fileName}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description - Only for Post */}
          {uploadType === 'post' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write a caption or share your story..."
                maxLength={2000}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none transition-all text-sm resize-none"
              />
              <div className="flex justify-end mt-2">
                <span className="text-xs text-gray-400">
                  {description.length}/2000
                </span>
              </div>
            </div>
          )}

          {/* Story Info */}
          {uploadType === 'story' && mediaData && (
            <div className="bg-blue-50 rounded-lg p-3 mb-6 flex items-center gap-3">
              <FontAwesomeIcon icon={faClock} className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-blue-700">
                Your story will disappear after 24 hours
              </span>
            </div>
          )}

          {/* Success Message */}
          {uploadSuccess && (
            <div className="bg-green-50 rounded-lg p-3 mb-6 flex items-center gap-3 animate-in fade-in duration-300">
              <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4 text-green-600" />
              <span className="text-xs text-green-700 font-medium">
                {uploadType === 'post' ? 'Post shared successfully!' : 'Story added successfully!'}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 flex-col sm:flex-row">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-3 px-4 bg-white text-gray-700 border border-gray-200 rounded-xl font-medium text-sm hover:border-gray-300 hover:text-gray-900 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || !mediaData || (uploadType === 'post' && !description.trim()) || uploadSuccess}
              className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                isUploading || !mediaData || (uploadType === 'post' && !description.trim()) || uploadSuccess
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow'
              }`}
            >
              {isUploading ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                  <span>{uploadType === 'post' ? 'Share Post' : 'Share Story'}</span>
                </>
              )}
            </button>
          </div>

          {/* Footer Note */}
          <p className="text-center text-xs text-gray-400 mt-6">
            By sharing, you agree to our terms of service
          </p>
        </form>
      </div>
    </div>
  );
}