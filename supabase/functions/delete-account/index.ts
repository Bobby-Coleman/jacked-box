// Permanently delete the signed-in user's account. Their profile, entitlement and usage rows are
// removed by ON DELETE CASCADE. Required by the App Store and Google Play for apps with accounts.
import { cors, json, adminClient, requestUser } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const user = await requestUser(req);
  if (!user) return json({ error: 'Not signed in' }, 401);

  const admin = adminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);

  // Also remove the subscriber from RevenueCat (their purchase history), when configured.
  const rcKey = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (rcKey) {
    await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${rcKey}` },
    }).catch(() => {});
  }
  return json({ ok: true });
});
