const nock = require('nock');

let fixtures;

function loadFixtures(file) {
  fixtures = require(file);
}

function mockResponse(id, filter = () => true) {
  const set = fixtures[id];
  nock(fixtures.base)
    .intercept(set.path || '', set.method || 'GET', (requestBody) => {
      return filter(requestBody);
    })
    .reply(() => {
      if (!set) {
        throw new Error('Fixtures not found!');
      }
      const { status, body, headers } = set;
      return [
        status,
        JSON.stringify(body),
        headers,
      ];
    });
}

class FakeKoaContext {
  constructor(options = {}) {
    this.request = {
      method: options.method || 'GET',
      query: {
        ...options.query,
      },
      body: {
        ...options.body,
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

  throw(status, msg) {
    throw new Error(msg);
  }
}

module.exports = {
  loadFixtures,
  mockResponse,
  FakeKoaContext,
};
