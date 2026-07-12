const TOKEN = process.argv[2];
if (!TOKEN) { console.error("Usage: node test-graph-api.mjs <token>"); process.exit(1); }

const BASE = "https://graph.facebook.com/v21.0";

console.log("1. Fetching /me/accounts to find linked Instagram Business Account...");
const pagesResp = await fetch(`${BASE}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${TOKEN}`);
const pagesData = await pagesResp.json();
console.log("Response:", JSON.stringify(pagesData, null, 2));

const pages = pagesData.data ?? [];
let igAccount = null;
for (const page of pages) {
  if (page.instagram_business_account?.id) {
    igAccount = page.instagram_business_account;
    console.log(`\n✅ Found Instagram account: @${igAccount.username} (id: ${igAccount.id})`);
    break;
  }
}

if (!igAccount) { console.log("\n❌ No Instagram Business Account found linked to this token."); process.exit(1); }

console.log("\n2. Fetching media...");
const mediaResp = await fetch(`${BASE}/${igAccount.id}/media?fields=id,media_type,media_product_type,caption,like_count,timestamp&limit=5&access_token=${TOKEN}`);
const mediaData = await mediaResp.json();
console.log(`Got ${mediaData.data?.length ?? 0} media items`);
if (mediaData.data?.[0]) {
  const m = mediaData.data[0];
  console.log("First item:", { id: m.id, type: m.media_type, product: m.media_product_type, likes: m.like_count });
}

if (mediaData.error) console.log("Media error:", mediaData.error);

console.log("\n3. Fetching insights for first reel...");
const reels = (mediaData.data ?? []).filter(m => m.media_type === "VIDEO" || m.media_product_type === "REELS");
if (reels[0]) {
  const insightsResp = await fetch(`${BASE}/${reels[0].id}/insights?metric=reach,saved,shares,views&access_token=${TOKEN}`);
  const insightsData = await insightsResp.json();
  console.log("Insights:", JSON.stringify(insightsData.data ?? insightsData.error, null, 2));
} else {
  console.log("No reels found to test insights.");
}
