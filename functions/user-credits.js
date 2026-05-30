const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  const { user } = context.clientContext;
  if (!user) return { statusCode: 401, body: 'Unauthorized' };

  if (event.httpMethod === 'GET') {
    // Get user credits
    const { data, error } = await supabase
      .from('users')
      .select('credits')
      .eq('netlify_id', user.sub)
      .single();

    if (error || !data) {
      // User doesn't exist yet — create one with 2 free credits
      const { error: insertError } = await supabase
        .from('users')
        .insert({ netlify_id: user.sub, email: user.email, credits: 2 });
      if (insertError) return { statusCode: 500, body: insertError.message };
      return { statusCode: 200, body: JSON.stringify({ credits: 2 }) };
    }

    return { statusCode: 200, body: JSON.stringify({ credits: data.credits }) };
  }

  if (event.httpMethod === 'POST') {
    const { amount, userId } = JSON.parse(event.body);
    let targetId = user.sub;
    // Admin check
    if (userId && user.app_metadata?.roles?.includes('admin')) {
      targetId = userId;
    }

    // Get current credits
    const { data: current, error: fetchError } = await supabase
      .from('users')
      .select('credits')
      .eq('netlify_id', targetId)
      .single();
    if (fetchError) return { statusCode: 404, body: 'User not found' };

    const newCredits = current.credits + amount;
    const { error: updateError } = await supabase
      .from('users')
      .update({ credits: newCredits })
      .eq('netlify_id', targetId);
    if (updateError) return { statusCode: 500, body: updateError.message };

    return { statusCode: 200, body: JSON.stringify({ credits: newCredits }) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
