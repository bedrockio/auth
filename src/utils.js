function encodeState(state) {
  return Buffer.from(JSON.stringify(state)).toString('base64');
}

function decodeState(str) {
  return str ? JSON.parse(Buffer.from(str, 'base64').toString()) : null;
}

function wrapMiddleware(opts) {
  return async (ctx, next) => {
    const fn = opts[ctx.request.method];
    if (!fn) {
      ctx.throw(405, 'Method not allowed');
    }
    return fn(ctx, next);
  };
}

module.exports = {
  encodeState,
  decodeState,
  wrapMiddleware,
};
