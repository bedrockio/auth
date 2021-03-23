const { OAuth2Client } = require('./apple-auth-library');
const { wrapMiddleware, encodeState, decodeState } = require('./utils');

const provider = 'apple';

function resolveNames(body) {
  if (body.user) {
    const { name } = JSON.parse(body.user);
    return name;
  }
  return {};
}

function appleAuthMiddleware(config = {}) {
  const client = new OAuth2Client(config);

  return wrapMiddleware({
    GET: (ctx) => {
      const state = encodeState({
        app: 'web',
        returnUrl: ctx.request.query.return || ctx.headers.referer,
      });
      const authUrl = client.generateAuthUrl({
        state,
      });
      ctx.redirect(authUrl);
    },
    POST: async (ctx, next) => {
      try {
        const { body } = ctx.request;
        const state = body.state ? decodeState(body.state) : {};
        const app = state.app || 'ios';
        const tokenData = await client.validateCode({
          app,
          code: body.code,
        });
        const names = resolveNames(body);
        ctx.state.authInfo = {
          app,
          names,
          provider,
          ...state,
          ...tokenData,
        };
        return next();
      } catch (err) {
        ctx.throw(400, 'Invalid request');
      }
    },
  });
}

module.exports = {
  appleAuthMiddleware,
};
