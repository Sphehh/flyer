const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  const { user } = context.clientContext;
  if (!user) return { statusCode: 401, body: 'Unauthorized' };

  // Get user credits
  const { data, error } = await supabase
    .from('users')
    .select('credits')
    .eq('netlify_id', user.sub)
    .single();

  if (error || !data || data.credits < 2) {
    return { statusCode: 402, body: JSON.stringify({ error: 'Insufficient credits' }) };
  }

  const { prompt, ratio, resolution } = JSON.parse(event.body);

  try {
    // Call PiAPI
    const piRes = await fetch('https://api.piapi.ai/api/v1/task', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.PIAPI_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini',
        task_type: 'nano-banana-2',
        input: { prompt, output_format: 'png', aspect_ratio: ratio, resolution }
      })
    });
    const piData = await piRes.json();
    if (piData.code !== 200) throw new Error(piData.message);

    const taskId = piData.data.task_id;
    let imageUrl = null;
    for (let i = 0; i < 45; i++) {
      await new Promise(r => setTimeout(r, 4000));
      const pollRes = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
        headers: { 'x-api-key': process.env.PIAPI_KEY }
      });
      const pollData = await pollRes.json();
      const status = pollData.data?.status || pollData.status;
      if (status === 'completed') {
        imageUrl = pollData.data?.output?.image_url || pollData.output?.image_url;
        break;
      } else if (status === 'failed') {
        throw new Error('Generation failed');
      }
    }
    if (!imageUrl) throw new Error('Timed out');

    // Deduct credits
    await supabase
      .from('users')
      .update({ credits: data.credits - 2 })
      .eq('netlify_id', user.sub);

    return { statusCode: 200, body: JSON.stringify({ image: imageUrl }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
