const { OAuth2Client } = require('google-auth-library');

function encodeState(state) {
  return Buffer.from(JSON.stringify(state)).toString('base64');
}

function decodeState(str) {
  return str ? JSON.parse(Buffer.from(str, 'base64').toString()) : null;
}

async function resolveEmail(client) {
  const { email } = await client.getTokenInfo(client.credentials.access_token);
  return email;
}

async function resolveNames(client) {
  const { data } = await client.request({
    url: 'https://people.googleapis.com/v1/people/me?personFields=names',
  });
  let name;
  name = data.names.find((n) => {
    return n.metadata.primary;
  });
  if (!name) {
    name = data.names[0];
  }
  if (name) {
    const { metadata, ...rest } = name;
    return rest;
  }
}

function googleAuthMiddleware(options = {}) {
  const { clientId, clientSecret, redirectUri } = options;
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  return async (ctx, next) => {
    const { query } = ctx.request;
    if (query.code) {
      const { tokens } = await client.getToken(query.code);
      client.setCredentials(tokens);
      const [email, names] = await Promise.all([resolveEmail(client), resolveNames(client)]);
      ctx.state.oAuthInfo = {
        email,
        names,
        ...decodeState(query.state),
      };
      return next();
    } else {
      const returnUrl = query.return || ctx.headers.referer;
      let state;
      if (returnUrl) {
        state = encodeState({
          returnUrl,
        });
      }
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: 'email profile',
        state,
      });
      ctx.redirect(authUrl);
    }
  };
}

module.exports = {
  googleAuthMiddleware,
};
