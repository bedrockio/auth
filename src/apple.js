const { encodeState, decodeState } = require('./utils');
const { OAuth2Client } = require('./apple-auth-library');


function resolveNames(body) {
  if (body.user) {
    const { name } = JSON.parse(body.user);
    return name;
  }
  return {};
}


function appleAuthMiddleware(config = {}) {

  const client = new OAuth2Client(config);

  return async (ctx, next) => {
    const { method, body } = ctx.request;
    if (method === 'POST') {
      try {
        const state = body.state ? decodeState(body.state) : {};
        const app = state.app || 'ios';
        const email = await client.validateCode({
          app,
          code: body.code,
        });
        ctx.state.authInfo = {
          email,
          names: resolveNames(body),
        };
        return next();
      } catch(err) {
        ctx.throw(400, 'Invalid request');
      }
    } else if (method === 'GET') {
      const state = encodeState({
        app: 'web',
        returnUrl: ctx.request.query.return || ctx.headers.referer,
      });
      const authUrl = client.generateAuthUrl({
        state,
      });
      ctx.redirect(authUrl);
    } else {
      ctx.throw(405, 'Method not allowed');
    }
  };
}

module.exports = {
  appleAuthMiddleware,
};
