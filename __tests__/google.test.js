const { googleAuthMiddleware } = require('../src/google');

class FakeKoaContext {
  constructor(options = {}) {
    this.request = {
      query: {
        ...options.query,
      },
    };
    this.headers = {
      ...options.headers,
    };
    this.state = {};
  }

  redirect(url) {
    this.redirectedUrl = url;
  }
}

describe('googleAuthMiddleware', () => {
  it('should redirect with no code param', async () => {
    const ctx = new FakeKoaContext();
    await googleAuthMiddleware()(ctx, () => {});
    expect(ctx.redirectedUrl).toBe('https://fakeauth.com/');
  });

  it('should redirect accept optional return url', async () => {
    const ctx = new FakeKoaContext({
      query: {
        return: 'fake return',
      },
    });
    await googleAuthMiddleware()(ctx, () => {});
    const state = Buffer.from(JSON.stringify({ returnUrl: 'fake return' })).toString('base64');
    expect(ctx.redirectedUrl).toBe(`https://fakeauth.com/?state=${state}`);
  });

  it('should throw error with bad code', async () => {
    const ctx = new FakeKoaContext({
      query: {
        code: 'bad code',
      },
    });
    await expect(googleAuthMiddleware()(ctx, () => {})).rejects.toEqual(new Error('invalid_grant'));
  });

  it('should succeed with valid code', async () => {
    const ctx = new FakeKoaContext({
      query: {
        code: 'valid code',
      },
    });
    await googleAuthMiddleware()(ctx, () => {});
    expect(ctx.state.oAuthInfo).toEqual({
      email: 'fake email',
      names: {
        givenName: 'Bob',
        familyName: 'Johnson',
      }
    });
  });
});

