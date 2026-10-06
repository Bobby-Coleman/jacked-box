// Live host voice for things players type (answers, crimes, names we haven't pre-rendered), in
// BOXTER's ElevenLabs voice. Premium accounts only, with a daily character cap and a shared cache
// so repeated lines are free. The ElevenLabs key lives only here (ELEVENLABS_API_KEY secret).
import { cors, json, adminClient, requestUser } from '../_shared/http.ts';

const VOICE_ID = Deno.env.get('ELEVENLABS_VOICE_ID') || '';
const MODEL = Deno.env.get('ELEVENLABS_LIVE_MODEL') || 'eleven_flash_v2_5';
const DAILY_CHARS = Number(Deno.env.get('TTS_DAILY_CHARS') || 6000);

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const key = Deno.env.get('ELEVENLABS_API_KEY');
  if (!key || !VOICE_ID) return json({ error: 'live voice not configured' }, 503);

  const user = await requestUser(req);
  if (!user) return json({ error: 'Not signed in' }, 401);

  const body = await req.json().catch(() => ({}));
  const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  if (!text) return json({ error: 'no text' }, 400);

  const admin = adminClient();
  const { data: ent } = await admin.from('entitlements').select('premium, expires_at').eq('user_id', user.id).maybeSingle();
  const premium = !!ent?.premium && (!ent.expires_at || Date.parse(ent.expires_at) > Date.now());
  if (!premium) return json({ error: 'Premium only' }, 403);

  // Cache hit: shared across everyone (same text, same voice).
  const name = `${VOICE_ID}/${await sha256(MODEL + '|' + text)}.mp3`;
  const bucket = admin.storage.from('tts-cache');
  const publicUrl = bucket.getPublicUrl(name).data.publicUrl;
  const head = await fetch(publicUrl, { method: 'HEAD' });
  if (head.ok) return json({ url: publicUrl, cached: true });

  // Daily cap per account keeps the ElevenLabs bill predictable.
  const { data: used, error: usageError } = await admin.rpc('add_tts_chars', { p_user: user.id, p_chars: text.length });
  if (usageError) return json({ error: usageError.message }, 500);
  if (used > DAILY_CHARS) return json({ error: 'Daily voice limit reached' }, 429);

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_22050_32`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
    }),
  });
  if (!res.ok) return json({ error: `voice service error ${res.status}` }, 502);
  const audio = new Uint8Array(await res.arrayBuffer());
  await bucket.upload(name, audio, { contentType: 'audio/mpeg', upsert: true, cacheControl: '31536000' });
  return json({ url: publicUrl, cached: false });
});
