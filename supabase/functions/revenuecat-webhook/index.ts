// RevenueCat -> Supabase: keep each account's Premium entitlement in sync with the App Store and
// Google Play, so Premium bought on a phone also works on the web when you're signed in.
// Set the same secret here (REVENUECAT_WEBHOOK_SECRET) and as the webhook's Authorization header
// in RevenueCat (Project -> Integrations -> Webhooks).
import { json, adminClient } from '../_shared/http.ts';

const ENTITLEMENT = 'premium';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Our app user IDs are Supabase user IDs; anonymous RevenueCat IDs ($RCAnonymousID:…) aren't accounts.
function accountIds(event: Record<string, any>): string[] {
  const ids = [event.app_user_id, event.original_app_user_id, ...(event.aliases || []), ...(event.transferred_to || [])];
  return [...new Set(ids.filter((id) => typeof id === 'string' && UUID.test(id)))];
}

type State = { premium: boolean; expires_at: string | null; will_renew: boolean; product_id: string | null; store: string | null };

// Most reliable: ask RevenueCat for the subscriber's current state (handles every event type).
async function stateFromApi(userId: string): Promise<State | null> {
  const key = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!key) return null;
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const body = await res.json();
  const ent = body?.subscriber?.entitlements?.[ENTITLEMENT];
  if (!ent) return { premium: false, expires_at: null, will_renew: false, product_id: null, store: null };
  const exp = ent.expires_date ? Date.parse(ent.expires_date) : null;
  const sub = body.subscriber.subscriptions?.[ent.product_identifier];
  return {
    premium: exp === null || exp > Date.now(),
    expires_at: ent.expires_date || null,
    will_renew: !!sub && !sub.unsubscribe_detected_at,
    product_id: ent.product_identifier || null,
    store: sub?.store || null,
  };
}

// Fallback: read the event itself.
function stateFromEvent(event: Record<string, any>): State {
  const hasEnt = (event.entitlement_ids || []).includes(ENTITLEMENT) || event.entitlement_id === ENTITLEMENT;
  const exp = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
  const active = hasEnt && event.type !== 'EXPIRATION' && (!event.expiration_at_ms || event.expiration_at_ms > Date.now());
  return {
    premium: active,
    expires_at: exp,
    will_renew: active && !['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'].includes(event.type),
    product_id: event.product_id || null,
    store: event.store || null,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const auth = req.headers.get('Authorization') || '';
  if (!secret || (auth !== secret && auth !== `Bearer ${secret}`)) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => null);
  const event = body?.event;
  if (!event) return json({ error: 'no event' }, 400);
  if (event.type === 'TEST') return json({ ok: true, test: true });

  const admin = adminClient();
  const ids = accountIds(event);
  for (const userId of ids) {
    const state = (await stateFromApi(userId)) || stateFromEvent(event);
    const { error } = await admin.from('entitlements').upsert({ user_id: userId, ...state, updated_at: new Date().toISOString() });
    // A user ID that isn't (or is no longer) an account fails the foreign key: ignore it.
    if (error && !/foreign key/i.test(error.message)) return json({ error: error.message }, 500);
  }
  return json({ ok: true, accounts: ids.length });
});
