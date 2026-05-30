const crypto = require('crypto');
const faunadb = require('faunadb');
const q = faunadb.query;
const client = new faunadb.Client({ secret: process.env.FAUNADB_SECRET });

exports.handler = async (event) => {
  const pfData = event.body; // already parsed by Netlify
  const pfParamString = Object.keys(pfData)
    .filter(k => k !== 'signature')
    .sort()
    .map(k => `${k}=${encodeURIComponent(pfData[k].trim()).replace(/%20/g, '+')}`)
    .join('&');
  const passphrase = process.env.PAYFAST_PASSPHRASE;
  const signature = crypto.createHash('md5').update(pfParamString + '&passphrase=' + passphrase).digest('hex');

  if (signature !== pfData.signature) {
    return { statusCode: 400, body: 'Invalid signature' };
  }

  // Verify with PayFast (optional but recommended)
  // ...

  const netlifyUserId = pfData.custom_str1;
  const creditsPurchased = parseInt(pfData.item_name); // e.g., "10 Credits"
  try {
    const userDoc = await client.query(q.Get(q.Match(q.Index('users_by_netlify_id'), netlifyUserId)));
    await client.query(q.Update(userDoc.ref, { data: { credits: userDoc.data.credits + creditsPurchased } }));
  } catch (e) {
    // User not found, maybe create?
  }

  return { statusCode: 200, body: 'OK' };
};
