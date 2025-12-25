interface Env {
  MUSIC_BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const prefix = url.searchParams.get('prefix') || '';
  const limit = Number(url.searchParams.get('limit') || '1000');
  const debug = url.searchParams.get('debug');
  const probe = url.searchParams.get('probe');

  try {
    const res = await env.MUSIC_BUCKET.list({ prefix, limit });
    const objects = (res.objects || []).map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded }));
    if (probe) {
      try {
        const obj = await env.MUSIC_BUCKET.get(probe);
        if (!obj) {
          return new Response(JSON.stringify({ found: false, probe }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
        // try to read some metadata
        const size = obj.size || null;
        const contentType = obj.httpMetadata?.contentType || null;
        return new Response(JSON.stringify({ found: true, probe, size, contentType }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

    if (debug) {
      const info = {
        bindingPresent: !!env.MUSIC_BUCKET,
        bucketNameEnv: env.R2_BUCKET_NAME || null,
        requestedPrefix: prefix,
        requestedLimit: limit,
        objectsCount: objects.length,
        objectsSample: objects.slice(0, 20),
      };
      return new Response(JSON.stringify({ objects, debug: info }, null, 2), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({ objects }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
