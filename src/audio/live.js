// Live host voice for text players typed (Premium rooms, when the tts edge function is set up):
// returns a URL to an mp3 in BOXTER's ElevenLabs voice, or null to use the phone's own voice.
import { LIVE_VOICE } from '../config.js';
import { account, supabase } from '../account/account.js';

const cache = new Map();

export async function liveClipUrl(text) {
  if (!LIVE_VOICE || !account.user || !account.premium || !text) return null;
  const key = String(text).trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    try {
      const sb = await supabase();
      if (!sb) return null;
      const { data, error } = await sb.functions.invoke('tts', { body: { text } });
      return !error && data && data.url ? data.url : null;
    } catch (e) {
      return null;
    }
  })();
  cache.set(key, p);
  return p;
}
