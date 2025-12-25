interface Env {
  MUSIC_BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) return new Response(JSON.stringify({ error: 'key is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  try {
    const obj = await env.MUSIC_BUCKET.get(key);
    if (!obj) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    // Read full body (small/medium files). For large files consider streaming or signed URLs.
    const buffer = await obj.arrayBuffer();
    const range = request.headers.get('range');
    const total = buffer.byteLength;
    const contentType = obj.httpMetadata?.contentType || 'audio/mpeg';

    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : (total - 1);
        const clampedEnd = Math.min(end, total - 1);
        if (start >= total || start > clampedEnd) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
        }
        const sliced = buffer.slice(start, clampedEnd + 1);
        return new Response(sliced, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${clampedEnd}/${total}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(sliced.byteLength),
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(total),
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
