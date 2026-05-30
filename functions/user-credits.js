const faunadb = require('faunadb');
const q = faunadb.query;
const client = new faunadb.Client({ secret: process.env.FAUNADB_SECRET });

exports.handler = async (event, context) => {
  const { user } = context.clientContext;
  if (!user) return { statusCode: 401, body: 'Unauthorized' };

  if (event.httpMethod === 'GET') {
    try {
      const userDoc = await client.query(q.Get(q.Match(q.Index('users_by_netlify_id'), user.sub)));
      return { statusCode: 200, body: JSON.stringify({ credits: userDoc.data.credits }) };
    } catch (e) {
      return { statusCode: 404, body: 'User not found' };
    }
  }

  if (event.httpMethod === 'POST') {
    const { amount, userId } = JSON.parse(event.body);
    // If admin updating another user
    let targetId = user.sub;
    if (userId && user.app_metadata?.roles?.includes('admin')) {
      targetId = userId;
    }
    try {
      const userDoc = await client.query(q.Get(q.Match(q.Index('users_by_netlify_id'), targetId)));
      const newCredits = userDoc.data.credits + amount;
      await client.query(q.Update(userDoc.ref, { data: { credits: newCredits } }));
      return { statusCode: 200, body: JSON.stringify({ credits: newCredits }) };
    } catch (e) {
      return { statusCode: 500, body: e.message };
    }
  }
};
