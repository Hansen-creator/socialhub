// app/story/[id]/page.tsx
import { Metadata } from 'next';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import StoryViewerClient from './StoryViewerClient';

interface Props {
  params: { id: string };
}

// 1. DYNAMIC METADATA: Menaikkan skor SEO & CTR secara signifikan
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const storyId = params.id;
  let userName = 'Developer';

  try {
    const storyDoc = await getDoc(doc(db, 'stories', storyId));
    if (storyDoc.exists()) {
      userName = storyDoc.data().userName || userName;
    }
  } catch (error) {
    console.error('Error fetching story metadata:', error);
  }

  return {
    title: `Cerita dari ${userName} | SocialHub`,
    description: `Lihat update terbaru, proyek, dan aktivitas harian dari ${userName} di SocialHub.`,
    openGraph: {
      title: `Cerita dari ${userName} | SocialHub`,
      description: `Lihat update terbaru, proyek, dan aktivitas harian dari ${userName} di SocialHub.`,
      type: 'article',
    },
  };
}

export default function StoryPage({ params }: Props) {
  // 2. SCHEMA MARKUP (JSON-LD): Menaikkan skor Schema (33) menjadi maksimal
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    'identifier': params.id,
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': `https://socialhub-tfxh.vercel.app/story/${params.id}`,
    },
    'publisher': {
      '@type': 'Organization',
      'name': 'SocialHub',
      'logo': {
        '@type': 'ImageObject',
        'url': 'https://socialhub-tfxh.vercel.app/logo.svg',
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StoryViewerClient />
    </>
  );
}
