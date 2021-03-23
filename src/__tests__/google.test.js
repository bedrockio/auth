const { googleAuthMiddleware } = require('../google');
const { FakeKoaContext } = require('../test-utils');

describe('googleAuthMiddleware', () => {

  describe('generateAuthUrl', () => {
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

  });

  describe('validating code', () => {

    it('should throw error with bad code', async () => {
      const ctx = new FakeKoaContext({
        query: {
          code: 'bad code',
        },
      });
      await expect(googleAuthMiddleware()(ctx, () => {})).rejects.toEqual(new Error('invalid_grant'));
    });

  });

  it('should succeed with valid code', async () => {
    const ctx = new FakeKoaContext({
      query: {
        code: 'valid code',
      },
    });
    await googleAuthMiddleware()(ctx, () => {});
    expect(ctx.state.authInfo).toEqual({
      authId: 'fake aud',
      email: 'fake email',
      names: {
        firstName: 'Bob',
        lastName: 'Johnson',
        givenName: 'Bob',
        familyName: 'Johnson',
        displayName: 'Bob Johnson',
        unstructuredName: 'Bob Johnson',
        displayNameLastFirst: 'Johnson, Bob',
      }
    });
  });

  describe('error handling of other methods', () => {

    it('POST', async () => {
      const ctx = new FakeKoaContext({ method: 'POST' });
      await expect(googleAuthMiddleware()(ctx, () => {})).rejects.toThrow('Method not allowed');
    });

    it('PATCH', async () => {
      const ctx = new FakeKoaContext({ method: 'PATCH' });
      await expect(googleAuthMiddleware()(ctx, () => {})).rejects.toThrow('Method not allowed');
    });

    it('DELETE', async () => {
      const ctx = new FakeKoaContext({ method: 'DELETE' });
      await expect(googleAuthMiddleware()(ctx, () => {})).rejects.toThrow('Method not allowed');
    });
  });

});

