const { OAuth2Client } = require('google-auth-library');
const { encodeState, decodeState } = require('./utils');

async function validateToken(client) {
  const { email, aud: authId } = await client.getTokenInfo(client.credentials.access_token);
  return { email, authId };
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
    return {
      ...rest,
      // Normalize firstName and lastName
      firstName: rest.givenName,
      lastName: rest.familyName,
    };
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
      const [tokenData, names] = await Promise.all([validateToken(client), resolveNames(client)]);
      ctx.state.authInfo = {
        names,
        ...tokenData,
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
