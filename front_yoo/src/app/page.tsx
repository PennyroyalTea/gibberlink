import AudioMessenger from '@/components/AudioMessenger';

export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-white">Audio Messenger</h1>
        <AudioMessenger />
      </div>
    </main>
  );
} 