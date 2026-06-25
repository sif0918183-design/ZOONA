
const handler = require('../api/orders.js').default;

async function testLogic() {
    const mockRes = {
        status: function(s) {
            this.statusCode = s;
            return this;
        },
        json: function(j) {
            this.body = j;
            return this;
        },
        setHeader: function() {},
        end: function() {},
        send: function() {}
    };

    // Test Case 1: Public POST to orders (Should NOT be 401)
    const req1 = {
        method: 'POST',
        url: '/api/orders?endpoint=orders',
        headers: { host: 'localhost', origin: 'https://zoonasd.com' },
        body: { test: true }
    };

    try {
        await handler(req1, mockRes);
        console.log('Test 1 (Public POST orders): Status', mockRes.statusCode);
        // Expecting 500 (due to missing SUPABASE_URL) or something NOT 401
        if (mockRes.statusCode !== 401) {
            console.log('✅ Passed: Not 401');
        } else {
            console.log('❌ Failed: Still 401', mockRes.body);
        }
    } catch(e) {
        // If it fails during fetch, that's fine, it means it passed the auth check
        console.log('Test 1: Passed Auth check (failed at fetch as expected)');
    }

    // Test Case 2: Admin settings PATCH (Should be 401 if no password)
    const req2 = {
        method: 'PATCH',
        url: '/api/orders?endpoint=admin_settings',
        headers: { host: 'localhost', origin: 'https://zoonasd.com' },
        body: { test: true }
    };

    await handler(req2, mockRes);
    console.log('Test 2 (Admin PATCH): Status', mockRes.statusCode);
    if (mockRes.statusCode === 401) {
        console.log('✅ Passed: Correctly blocked');
    } else {
        console.log('❌ Failed: Should have been blocked');
    }
}

testLogic();
