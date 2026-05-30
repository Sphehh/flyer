exports.handler = async (event, context) => {
  const { user } = context.clientContext;
  if (!user) return { statusCode: 401 };
  if (user.app_metadata?.roles?.includes('admin')) {
    return { statusCode: 200, body: 'ok' };
  }
  return { statusCode: 403, body: 'Forbidden' };
};
