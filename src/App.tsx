import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Shuffle, ListMusic, Search } from 'lucide-react';

type Track = { key: string; size?: number; lastModified?: string };

function shortName(key: string) {
  try {
    const parts = key.split('/');
    const name = parts[parts.length - 1];
    return decodeURIComponent(name);
  } catch {
    return key;
  }
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [randomMode, setRandomMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadList();
  }, []);

  async function loadList() {
    setLoading(true);
    try {
      const res = await fetch('/api/list');
      const data = await res.json();
      const objs: Track[] = (data.objects || []).filter((o: any) => {
        const k = (o.Key || o.key || '').toLowerCase();
        return k.endsWith('.mp3') || k.endsWith('.m4a') || k.endsWith('.wav') || k.endsWith('.ogg') || k.endsWith('.flac');
      }).map((o: any) => ({ key: o.Key || o.key, size: o.Size || o.size, lastModified: o.LastModified || o.lastModified }));
      setTracks(objs);
    } catch (err) {
      console.error('load list failed', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = tracks.filter(t => shortName(t.key).toLowerCase().includes(filter.toLowerCase()));

  async function playAt(index: number) {
    const t = filtered[index];
    if (!t) return;
    try {
      // set current index immediately for UI responsiveness
      const globalIndex = tracks.findIndex(x => x.key === t.key);
      setCurrentIndex(globalIndex === -1 ? null : globalIndex);

      const res = await fetch(`/api/get-audio?key=${encodeURIComponent(t.key)}`);
      const { url } = await res.json();
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('play failed', err);
    }
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }

  function pickNext() {
    console.log('pickNext called, tracks:', tracks.length, 'randomMode:', randomMode, 'filtered:', filtered.length);
    if (tracks.length === 0) {
      console.log('No tracks available');
      return;
    }
    if (randomMode) {
      const idx = Math.floor(Math.random() * tracks.length);
      const t = tracks[idx];
      console.log('Random mode: picked track index', idx, 'key:', t.key);
      const filteredIndex = filtered.findIndex(f => f.key === t.key);
      if (filteredIndex >= 0) playAt(filteredIndex);
      else playAt(0);
      return;
    }
    if (currentIndex === null) {
      console.log('Current index is null, playing first track');
      playAt(0);
      return;
    }
    const next = (currentIndex + 1) % tracks.length;
    const filteredIndex = filtered.findIndex(f => f.key === tracks[next].key);
    console.log('Sequential mode: next index in filtered:', filteredIndex);
    if (filteredIndex >= 0) playAt(filteredIndex);
  }


  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-xl">
        <header className="flex items-center gap-3 mb-4">
          <ListMusic className="w-10 h-10" />
          <h1 className="text-2xl font-bold">音乐播放器</h1>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => {
              setRandomMode(r => !r);
              pickNext();
            }} className={`p-3 rounded-xl ${randomMode ? 'bg-emerald-500' : 'bg-white/10'}`} aria-label="随机播放">
              <Shuffle className="w-20 h-6" />
            </button>
          </div>
        </header>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-6 h-6 text-white/60" />
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="搜索音乐名" className="w-full pl-12 pr-3 py-4 text-lg rounded-lg bg-white/6 placeholder-white/60" />
          </div>
        </div>

        <main className="bg-white/5 rounded-xl p-3 max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="py-10 text-center">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-white/60">没有找到音乐</div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((t, i) => (
                <li key={t.key} onClick={() => playAt(i)} className="flex items-center justify-between p-3 rounded-md hover:bg-white/6 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/6 rounded-md flex items-center justify-center">🎵</div>
                    <div>
                      <div className="font-semibold text-sm">{shortName(t.key)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>

        <footer className="fixed bottom-4 left-0 right-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-xl bg-white/6 backdrop-blur rounded-xl p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm font-semibold">{currentIndex !== null ? shortName(tracks[currentIndex]?.key || '') : '未选择'}</div>
              <div className="text-xs text-white/60">{currentIndex !== null ? (tracks[currentIndex]?.lastModified || '') : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={togglePlay} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </footer>

        <audio ref={audioRef} onEnded={() => pickNext()} />
      </div>
    </div>
  );
}