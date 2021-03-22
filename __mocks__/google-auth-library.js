


class OAuth2Client {

  constructor(clientId, clientSecret, redirectUri) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.requestedUrls = [];
  }

  generateAuthUrl({ state }) {
    const url = new URL('https://fakeauth.com/');
    if (state) {
      url.searchParams.set('state', state);
    }
    return url.toString();
  }

  setCredentials(credentials) {
    this.credentials = credentials;
  }

  getToken(code) {
    if (code === 'bad code') {
      throw new Error('invalid_grant');
    }
    return {
      tokens: {
        access_token: 'fake access token',
      },
    };
  }

  getTokenInfo() {
    return {
      email: 'fake email',
    };
  }

  request(options) {
    this.requestedUrls.push(options.url);
    return {
      data: {
        names: [
          {
            metadata: {
              primary: true,
            },
            givenName: 'Bob',
            familyName: 'Johnson',
          }
        ]
      }
    };
  }
}

module.exports = {
  OAuth2Client,
};
