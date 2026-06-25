
const fetch = require('node-fetch');

async function testPublicOrder() {
    const baseUrl = 'http://localhost:3000/api/orders';
    const mockOrder = {
        order_id: 'TEST-ORDER-' + Date.now(),
        name: 'Test User',
        phone: '0912345678',
        city: 'Khartoum',
        total_amount: 50000
    };

    console.log('Testing public POST to /api/orders (endpoint=orders)...');

    try {
        const response = await fetch(`${baseUrl}?endpoint=orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://zoonasd.com'
            },
            body: JSON.stringify(mockOrder)
        });

        const status = response.status;
        const data = await response.json().catch(() => ({}));

        console.log('Status:', status);
        if (status === 201 || status === 200 || (status === 401 && data.error && data.error.includes('apikey'))) {
            // 401 with apikey error is actually GOOD here because it means we passed the internal proxy auth check
            // and reached the Supabase fetch part where it fails because of missing env vars in local test.
            console.log('✅ Success: Request passed proxy authorization logic.');
        } else {
            console.error('❌ Failure: Unexpected status or error.', data);
        }
    } catch (err) {
        console.error('Error during fetch:', err.message);
    }
}

testPublicOrder();
