# Music Shuttle

> A serverless music player built with Next.js and Cloudflare R2.  
> **Live:** [music.shuttlelab.org](https://music.shuttlelab.org/)

## Features

- Multiple formats: MP3, M4A, WAV, OGG, FLAC, MP4
- Shuffle and sequential playback
- Seekable progress bar
- Search
- Responsive layout (mobile & desktop)
- Cloud storage via Cloudflare R2
- Smart cache (Cache API) and prefetch for fast/offline playback

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Audio:** HTML5 Audio, Range requests (streaming), Cache API
- **Backend:** Next.js API Routes, Cloudflare R2 (S3-compatible)

## Project Structure

```
music-shuttle/
├── app/
│   ├── api/audio/route.ts   # GET /api/audio?key=...
│   ├── api/list/route.ts    # GET /api/list
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/player/MusicPlayer.tsx
├── lib/
│   ├── hooks/               # useMusicList, useAudioPlayer, useAudioCache, useAudioPrefetch
│   └── utils.ts
├── .env.local.example
└── wrangler.toml            # R2 binding for Cloudflare
```

## Quick Start

**Requirements:** Node.js 18+, npm/pnpm, Cloudflare account, R2 bucket with audio files.

```bash
git clone <your-repo-url>
cd music-shuttle
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).  
Note: R2 APIs need Cloudflare; for full behavior, deploy to Cloudflare Pages.

## Deploy to Cloudflare Pages

1. Connect repo to Cloudflare Pages.
2. **Build command:** `npx @cloudflare/next-on-pages@1`
3. **Output directory:** `.vercel/output/static`
4. In `wrangler.toml`, set R2 binding:

   ```toml
   compatibility_flags = ["nodejs_compat"]

   [[r2_buckets]]
   binding = "R2_BUCKET"
   bucket_name = "your-bucket-name"
   ```

No API keys needed; R2 is accessed via bindings.  
Full guide: [CLOUDFLARE_DEPLOYMENT.md](CLOUDFLARE_DEPLOYMENT.md)

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Local build |
| `npm run pages:build` | Build for Cloudflare Pages |
| `npm run lint` | Lint |

## API (after deploy)

- **List:** `GET /api/list` — optional: `?prefix=...`, `?limit=N`, `?demo=1`, `?debug=1`
- **Audio:** `GET /api/audio?key=filename.mp3` — supports Range for streaming

## FAQ

- **Empty list?** Check R2 binding in `wrangler.toml`, bucket name, and that files have supported extensions (.mp3, .m4a, .wav, .ogg, .flac, .mp4).
- **Two requests per track?** One is streaming (instant play), one is full prefetch for cache; this is intentional.
- **Clear cache:** DevTools → Application → Cache Storage → delete `music-shuttle-v1`, or run `caches.delete('music-shuttle-v1')` in console.

## Contributing

1. Fork the repo  
2. Create a branch: `git checkout -b feature/your-feature`  
3. Commit and push, then open a Pull Request  

## License

MIT
