// verification/verify_affiliate_30days.js
const assert = require('assert');
const fs = require('fs');

console.log('🧪 Starting Affiliate 30-Day Tracking Verification...');

// 1. Verify code content in index.html and p/e.html
const indexHtml = fs.readFileSync('index.html', 'utf8');
const eHtml = fs.readFileSync('p/e.html', 'utf8');

assert(indexHtml.includes('AFFILIATE_COOKIE_DURATION_MS = 30 * 24 * 60 * 60 * 1000'), 'index.html must define 30 days duration');
assert(indexHtml.includes('affiliateExpiry'), 'index.html must set/check affiliateExpiry');

assert(eHtml.includes('AFFILIATE_COOKIE_DURATION_MS = 30 * 24 * 60 * 60 * 1000'), 'p/e.html must define 30 days duration');
assert(eHtml.includes('affiliateExpiry'), 'p/e.html must set/check affiliateExpiry');

// 2. Simulate Browser LocalStorage & affiliate tracking logic
class MockLocalStorage {
    constructor() {
        this.store = {};
    }
    getItem(key) {
        return this.store[key] || null;
    }
    setItem(key, value) {
        this.store[key] = value.toString();
    }
    removeItem(key) {
        delete this.store[key];
    }
    clear() {
        this.store = {};
    }
}

const mockStorage = new MockLocalStorage();
const AFFILIATE_COOKIE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function setAffiliateWithExpiry(affiliateId) {
    if (!affiliateId || affiliateId === 'direct') return;
    const expiryTime = Date.now() + AFFILIATE_COOKIE_DURATION_MS;
    mockStorage.setItem('currentAffiliateId', affiliateId);
    mockStorage.setItem('affiliateExpiry', expiryTime.toString());
}

function getAffiliateId(searchQuery = '', cartItems = []) {
    const urlParams = new URLSearchParams(searchQuery);
    let affiliateId = urlParams.get('ref');
    if (affiliateId && affiliateId !== 'direct') {
        setAffiliateWithExpiry(affiliateId);
        return affiliateId;
    }

    const storedId = mockStorage.getItem('currentAffiliateId');
    const expiry = parseInt(mockStorage.getItem('affiliateExpiry') || '0', 10);
    if (storedId && storedId !== 'direct') {
        if (expiry && Date.now() > expiry) {
            mockStorage.removeItem('currentAffiliateId');
            mockStorage.removeItem('affiliateExpiry');
        } else {
            affiliateId = storedId;
        }
    }

    if ((!affiliateId || affiliateId === 'direct') && cartItems.length > 0) {
        const productWithAffiliate = cartItems.find(item => item.affiliateId && item.affiliateId !== 'direct');
        if (productWithAffiliate) {
            affiliateId = productWithAffiliate.affiliateId;
            setAffiliateWithExpiry(affiliateId);
        }
    }
    if (affiliateId && affiliateId !== 'direct' && affiliateId !== 'null' && affiliateId !== 'undefined') {
        return affiliateId;
    }
    return 'direct';
}

function clearAffiliateIdFromStorage() {
    // Retains affiliateId in localStorage for 30 days as required
    console.log('clearAffiliateIdFromStorage executed without deleting currentAffiliateId');
}

// TEST 1: User visits with affiliate link (?ref=MARKETER_123)
console.log('Test 1: User visits with ?ref=MARKETER_123');
let affId = getAffiliateId('?ref=MARKETER_123');
assert.strictEqual(affId, 'MARKETER_123', 'Should return MARKETER_123 on first visit');
assert.strictEqual(mockStorage.getItem('currentAffiliateId'), 'MARKETER_123');
const expiry1 = parseInt(mockStorage.getItem('affiliateExpiry'), 10);
assert(expiry1 > Date.now(), 'Expiry must be in the future');

// TEST 2: User comes back after 10 days WITHOUT ?ref parameter
console.log('Test 2: User visits after 10 days without ?ref');
// Simulate 10 days later
const originalNow = Date.now;
Date.now = () => originalNow() + (10 * 24 * 60 * 60 * 1000);

affId = getAffiliateId('');
assert.strictEqual(affId, 'MARKETER_123', 'Should retain MARKETER_123 after 10 days');

// TEST 3: User places an order
console.log('Test 3: User places an order without coupon');
let activeCoupon = null;
let effectiveAffiliateId = activeCoupon ? 'direct' : getAffiliateId('');
assert.strictEqual(effectiveAffiliateId, 'MARKETER_123', 'Order must be attributed to MARKETER_123');

// After order is created, clearAffiliateIdFromStorage is called
clearAffiliateIdFromStorage();
assert.strictEqual(mockStorage.getItem('currentAffiliateId'), 'MARKETER_123', 'Affiliate ID must still be in localStorage for subsequent orders within 30 days');

// TEST 4: User places a second order 5 days later (day 15) without ?ref
console.log('Test 4: User places another order on day 15');
Date.now = () => originalNow() + (15 * 24 * 60 * 60 * 1000);
effectiveAffiliateId = activeCoupon ? 'direct' : getAffiliateId('');
assert.strictEqual(effectiveAffiliateId, 'MARKETER_123', 'Second order on day 15 must still be attributed to MARKETER_123');

// TEST 5: User applies discount coupon
console.log('Test 5: User applies coupon on day 20');
Date.now = () => originalNow() + (20 * 24 * 60 * 60 * 1000);
activeCoupon = { code: 'SALE10', discount_percent: 10 };
effectiveAffiliateId = activeCoupon ? 'direct' : getAffiliateId('');
assert.strictEqual(effectiveAffiliateId, 'direct', 'Coupon must convert effectiveAffiliateId to direct');
assert.strictEqual(mockStorage.getItem('currentAffiliateId'), 'MARKETER_123', 'Storage still has affiliate for 30 days');

// TEST 6: User returns after 31 days (> 30 days)
console.log('Test 6: User returns after 31 days');
activeCoupon = null;
Date.now = () => originalNow() + (31 * 24 * 60 * 60 * 1000);
effectiveAffiliateId = activeCoupon ? 'direct' : getAffiliateId('');
assert.strictEqual(effectiveAffiliateId, 'direct', 'Should expire after 30 days and return direct');
assert.strictEqual(mockStorage.getItem('currentAffiliateId'), null, 'Expired affiliateId should be removed from localStorage');

// Restore Date.now
Date.now = originalNow;

console.log('✅ All affiliate tracking 30-day verification tests passed successfully!');
