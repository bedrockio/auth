const { appleAuthMiddleware } = require('../apple');
const { loadFixtures, mockResponse, FakeKoaContext } = require('../test-utils');

function getMiddleware() {
  return appleAuthMiddleware({
    appId: 'fakeApp',
    keyId: 'fakeKey',
    serviceId: 'fakeService',
    redirectUri: 'fakeRedirect',
    privateKey: '------- fake private key --------',
  });
}

beforeAll(() => {
  loadFixtures('../__fixtures__/apple.json');
});

describe('appleAuthMiddleware', () => {
  describe('GET', () => {
    it('should redirect with app state by default', async () => {
      const ctx = new FakeKoaContext();
      await getMiddleware()(ctx, () => {});
      const state = Buffer.from(JSON.stringify({ app: 'web' })).toString('base64');
      expect(ctx.redirectedUrl).toBe(
        `https://appleid.apple.com/auth/authorize?response_type=code+id_token&response_mode=form_post&redirect_uri=fakeRedirect&scope=name+email&client_id=fakeService&state=${encodeURIComponent(
          state
        )}`
      );
    });

    it('should redirect accept optional return url', async () => {
      const ctx = new FakeKoaContext({
        query: {
          return: 'fake return',
        },
      });
      await getMiddleware()(ctx, () => {});
      const state = Buffer.from(JSON.stringify({ app: 'web', returnUrl: 'fake return' })).toString('base64');
      expect(ctx.redirectedUrl).toBe(
        `https://appleid.apple.com/auth/authorize?response_type=code+id_token&response_mode=form_post&redirect_uri=fakeRedirect&scope=name+email&client_id=fakeService&state=${encodeURIComponent(
          state
        )}`
      );
    });
  });

  describe('POST', () => {
    describe('web', () => {
      it('should resolve email with valid code', async () => {
        mockResponse('success');
        const state = Buffer.from(JSON.stringify({ app: 'web' })).toString('base64');
        const ctx = new FakeKoaContext({
          method: 'POST',
          body: {
            state,
            code: 'valid code',
          },
        });
        await getMiddleware()(ctx, () => {});
        expect(ctx.state.authInfo).toEqual({
          app: 'web',
          provider: 'apple',
          authId: 'com.test',
          email: 'foo@bar.com',
          names: {},
        });
      });

      it('should include posted user information', async () => {
        mockResponse('success');
        const state = Buffer.from(JSON.stringify({ app: 'web' })).toString('base64');
        const ctx = new FakeKoaContext({
          method: 'POST',
          body: {
            state,
            code: 'valid code',
            user: '{"name":{"firstName":"Potato","lastName":"Head"},"email":"potato@head.com"}',
          },
        });
        await getMiddleware()(ctx, () => {});
        expect(ctx.state.authInfo).toEqual({
          app: 'web',
          provider: 'apple',
          authId: 'com.test',
          email: 'foo@bar.com',
          names: {
            firstName: 'Potato',
            lastName: 'Head',
          },
        });
      });

      it('should throw a 400 with invalid code', async () => {
        mockResponse('invalid-code');
        const ctx = new FakeKoaContext({
          method: 'POST',
          body: {
            code: 'invalid code',
          },
        });
        await expect(getMiddleware()(ctx, () => {})).rejects.toThrow('Invalid request');
      });
    });

    describe('ios', () => {
      it('should assume iOS when no state passed', async () => {
        mockResponse('success', (requestBody) => {
          return requestBody.client_id === 'fakeApp';
        });
        const ctx = new FakeKoaContext({
          method: 'POST',
          body: {
            code: 'valid code',
          },
        });
        await getMiddleware()(ctx, () => {});
        expect(ctx.state.authInfo).toEqual({
          app: 'ios',
          provider: 'apple',
          authId: 'com.test',
          email: 'foo@bar.com',
          names: {},
        });
      });
    });
  });

  describe('other', () => {
    it('should throw an error on PATCH', async () => {
      const ctx = new FakeKoaContext({ method: 'PATCH' });
      await expect(getMiddleware()(ctx, () => {})).rejects.toThrow('Method not allowed');
    });

    it('should throw an error on DELETE', async () => {
      const ctx = new FakeKoaContext({ method: 'DELETE' });
      await expect(getMiddleware()(ctx, () => {})).rejects.toThrow('Method not allowed');
    });
  });
});
