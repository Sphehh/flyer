const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event) => {
  const pfData = event.body;
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

  const netlifyUserId = pfData.custom_str1;
  const creditsPurchased = parseInt(pfData.item_name); // e.g., "10 Credits"

  // Get current credits
  const { data: current, error: fetchError } = await supabase
    .from('users')
    .select('credits')
    .eq('netlify_id', netlifyUserId)
    .single();

  if (fetchError || !current) {
    // User not found — create with purchased credits
    await supabase
      .from('users')
      .insert({ netlify_id: netlifyUserId, email: pfData.email_address, credits: creditsPurchased });
  } else {
    await supabase
      .from('users')
      .update({ credits: current.credits + creditsPurchased })
      .eq('netlify_id', netlifyUserId);
  }

  return { statusCode: 200, body: 'OK' };
};
