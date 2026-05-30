const crypto = require('crypto');

exports.handler = async (event, context) => {
  const { user } = context.clientContext;
  if (!user) return { statusCode: 401, body: 'Unauthorized' };

  const { amount } = JSON.parse(event.body);
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE;

  const data = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: 'https://your-site.netlify.app/dashboard',
    cancel_url: 'https://your-site.netlify.app/dashboard',
    notify_url: 'https://your-site.netlify.app/.netlify/functions/payfast-itn',
    name_first: 'Customer',
    email_address: user.email,
    m_payment_id: `${user.sub}_${Date.now()}`,
    amount: (amount * 9.99).toFixed(2),
    item_name: `${amount} Credits`,
    custom_str1: user.sub
  };

  // Generate signature
  const pfOutput = [];
  for (let key in data) {
    if (data.hasOwnProperty(key) && data[key] !== '') {
      pfOutput.push(`${key}=${encodeURIComponent(data[key].trim()).replace(/%20/g, '+')}`);
    }
  }
  const pfParamString = pfOutput.join('&');
  const signature = crypto.createHash('md5').update(pfParamString + '&passphrase=' + passphrase).digest('hex');
  data.signature = signature;

  const formHtml = `<form action="https://www.payfast.co.za/eng/process" method="post">
    ${Object.entries(data).map(([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`).join('')}
    <input type="submit" value="Pay with PayFast" style="display:none;" />
  </form>`;

  return { statusCode: 200, body: JSON.stringify({ form: formHtml }) };
};
