const { Octokit } = require('@octokit/rest');

exports.handler = async (event, context) => {
  const { user } = context.clientContext;
  if (!user || !user.app_metadata?.roles?.includes('admin')) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const owner = 'your-github-username';
  const repo = 'flyercraft';
  const path = 'prompts.json';

  const content = Buffer.from(event.body).toString('base64');
  const { data } = await octokit.repos.getContent({ owner, repo, path });
  await octokit.repos.createOrUpdateFileContents({
    owner, repo, path,
    message: 'Update prompts',
    content,
    sha: data.sha
  });

  return { statusCode: 200, body: 'Prompts updated' };
};
