import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://yhujvalqfmnlyffvejbh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlodWp2YWxxZm1ubHlmZnZlamJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNTc3OTcsImV4cCI6MjA3ODYzMzc5N30.mMG55moG7HdM-vDzT5R5HiD7kKdE_Jr9BkRio4MJGqw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function getAffiliateIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('ref');
}

export function saveAffiliateId(id) {
    if (id) {
        localStorage.setItem('zoona_affiliate_id', id);
    }
}

export function getSavedAffiliateId() {
    return localStorage.getItem('zoona_affiliate_id');
}

export async function recordAffiliateClick(affiliateId, productName = 'default') {
    if (!affiliateId) return;

    try {
        // Try to use RPC if available, fallback to fetch-then-update if it fails
        const { error: rpcError } = await supabase.rpc('increment_click_count', {
            target_affiliate_id: affiliateId,
            target_product_name: productName
        });

        if (rpcError) {
            console.warn('RPC increment_click_count failed, falling back to manual update:', rpcError);
            const { data: linkData } = await supabase
                .from('affiliate_tracking_links')
                .select('click_count')
                .eq('affiliate_id', affiliateId)
                .eq('product_name', productName)
                .single();

            if (linkData) {
                await supabase
                    .from('affiliate_tracking_links')
                    .update({
                        click_count: (linkData.click_count || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('affiliate_id', affiliateId)
                    .eq('product_name', productName);
            }
        }

        await supabase
            .from('affiliate_tracking_clicks')
            .insert([{
                affiliate_id: affiliateId,
                product_name: productName,
                tracking_url: window.location.href,
                click_type: 'direct',
                user_agent: navigator.userAgent,
                created_at: new Date().toISOString()
            }]);

    } catch (err) {
        console.error('Error recording affiliate click:', err);
    }
}

export async function recordAffiliateOrder(affiliateId, productName = 'default') {
    if (!affiliateId) return;

    try {
        const { error: rpcError } = await supabase.rpc('increment_order_count', {
            target_affiliate_id: affiliateId,
            target_product_name: productName
        });

        if (rpcError) {
            console.warn('RPC increment_order_count failed, falling back to manual update:', rpcError);
            const { data: linkData } = await supabase
                .from('affiliate_tracking_links')
                .select('order_count')
                .eq('affiliate_id', affiliateId)
                .eq('product_name', productName)
                .single();

            if (linkData) {
                await supabase
                    .from('affiliate_tracking_links')
                    .update({
                        order_count: (linkData.order_count || 0) + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('affiliate_id', affiliateId)
                    .eq('product_name', productName);
            }
        }

        await supabase
            .from('affiliate_tracking_clicks')
            .insert([{
                affiliate_id: affiliateId,
                product_name: productName,
                tracking_url: window.location.href,
                click_type: 'order',
                user_agent: navigator.userAgent,
                created_at: new Date().toISOString()
            }]);
    } catch (err) {
        console.error('Error recording affiliate order:', err);
    }
}
