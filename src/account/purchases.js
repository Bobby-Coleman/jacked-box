// In-app subscriptions on iOS and Android, through RevenueCat (Apple and Google billing).
// On the web there's no store: Premium comes from the account (see account.js), and the
// paywall points people to the apps.
import { PURCHASES } from '../config.js';
import { isNativeShell, platformName } from '../platform.js';

let P = null; // the RevenueCat plugin, once configured
const listeners = new Set();
let lastInfo = null;

export function onStoreChange(fn) {
  listeners.add(fn);
}

function publish(customerInfo) {
  const ent = customerInfo && customerInfo.entitlements && customerInfo.entitlements.active && customerInfo.entitlements.active[PURCHASES.entitlement];
  lastInfo = {
    active: !!(ent && ent.isActive !== false),
    until: (ent && ent.expirationDate) || null,
    willRenew: !!(ent && ent.willRenew),
    product: (ent && ent.productIdentifier) || null,
    manageUrl: (customerInfo && customerInfo.managementURL) || null,
  };
  for (const fn of listeners) fn(lastInfo);
}

export function storeAvailable() {
  return !!storeKey();
}

function storeKey() {
  if (!isNativeShell()) return '';
  const p = platformName();
  return p === 'ios' ? PURCHASES.iosKey : p === 'android' ? PURCHASES.androidKey : '';
}

export async function initStore(userId) {
  const apiKey = storeKey();
  if (!apiKey || P) return;
  try {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');
    await Purchases.configure({ apiKey, appUserID: userId || null });
    P = Purchases;
    await P.addCustomerInfoUpdateListener((info) => publish(info));
    const { customerInfo } = await P.getCustomerInfo();
    publish(customerInfo);
  } catch (e) {
    console.warn('store unavailable', e);
    P = null;
  }
}

// Tie purchases to the signed-in account (so Premium follows you to other devices and the web).
export async function identify(userId) {
  if (!P) return;
  try {
    if (userId) {
      const { customerInfo } = await P.logIn({ appUserID: userId });
      publish(customerInfo);
    } else {
      const { customerInfo } = await P.logOut();
      publish(customerInfo);
    }
  } catch (e) {
    /* logOut throws for anonymous users; nothing to do */
  }
}

export async function refresh() {
  if (!P) return lastInfo;
  const { customerInfo } = await P.getCustomerInfo();
  publish(customerInfo);
  return lastInfo;
}

// Plans for the paywall: [{ id, period: 'month'|'year', price, perMonth, title, pkg }]
export async function getPlans() {
  if (!P) return [];
  const offerings = await P.getOfferings();
  const cur = offerings && offerings.current;
  if (!cur) return [];
  const plans = [];
  for (const pkg of cur.availablePackages || []) {
    const t = pkg.packageType;
    const period = t === 'ANNUAL' ? 'year' : t === 'MONTHLY' ? 'month' : t === 'WEEKLY' ? 'week' : t === 'LIFETIME' ? 'lifetime' : null;
    if (!period) continue;
    const prod = pkg.product || {};
    plans.push({
      id: pkg.identifier,
      period,
      price: prod.priceString,
      perMonth: period === 'year' && prod.price ? formatMoney(prod.price / 12, prod.currencyCode) : null,
      title: prod.title,
      intro: prod.introPrice ? prod.introPrice.priceString + ' for ' + (prod.introPrice.periodNumberOfUnits || 1) + ' ' + String(prod.introPrice.periodUnit || '').toLowerCase() : null,
      pkg,
    });
  }
  const order = { year: 0, month: 1, week: 2, lifetime: 3 };
  return plans.sort((a, b) => order[a.period] - order[b.period]);
}

function formatMoney(v, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(v);
  } catch (e) {
    return v.toFixed(2);
  }
}

// Returns 'purchased' | 'cancelled'; throws with a readable message on errors.
export async function buy(plan) {
  if (!P) throw new Error('Purchases are only available in the RiffRaff app.');
  try {
    const { customerInfo } = await P.purchasePackage({ aPackage: plan.pkg });
    publish(customerInfo);
    return 'purchased';
  } catch (e) {
    if (e && (e.userCancelled || e.code === '1' || e.code === 1)) return 'cancelled';
    throw new Error((e && e.message) || 'The purchase did not go through.');
  }
}

export async function restore() {
  if (!P) throw new Error('Restoring purchases is only available in the RiffRaff app.');
  const { customerInfo } = await P.restorePurchases();
  publish(customerInfo);
  return lastInfo;
}

// Where to manage or cancel the subscription.
export function manageUrl() {
  if (lastInfo && lastInfo.manageUrl) return lastInfo.manageUrl;
  const p = platformName();
  if (p === 'ios') return 'https://apps.apple.com/account/subscriptions';
  if (p === 'android') return 'https://play.google.com/store/account/subscriptions';
  return null;
}
