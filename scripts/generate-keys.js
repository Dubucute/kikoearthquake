import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('');
console.log('Add these to your Vercel environment variables:');
console.log('  vercel secrets add vapid_public_key "' + keys.publicKey + '"');
console.log('  vercel secrets add vapid_private_key "' + keys.privateKey + '"');
