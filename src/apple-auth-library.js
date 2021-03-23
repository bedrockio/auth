const fs = require('fs');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const APPLE_AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize';
const APPLE_VALIDATE_URL = 'https://appleid.apple.com/auth/token';

const DEFAULT_OPTIONS = {
  scope: 'name email',
};

const PRIVATE_KEY_REG = /^-{3,}/;

class OAuth2Client {

  constructor(config) {
    this.config = {
      ...DEFAULT_OPTIONS,
      ...config,
    };
    this.setupPrivateKey();
  }

  setupPrivateKey() {
    const { privateKey } = this.config;
    if (!this.isPrivateKey(privateKey)) {
      this.config.privateKey = fs.readFileSync(privateKey, 'utf8');
    }
  }

  isPrivateKey(str) {
    return PRIVATE_KEY_REG.test(str);
  }

  getClientId(app = 'web') {
    const { appId, serviceId } = this.config;
    if (app === 'ios') {
      return appId;
    } else if (app === 'web') {
      return serviceId;
    } else {
      return serviceId || appId;
    }
  }

  generateAuthUrl(options) {
    const url = new URL(APPLE_AUTHORIZE_URL);
    url.searchParams.set('response_type', 'code id_token');
    url.searchParams.set('response_mode', 'form_post');
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', this.config.scope);

    // Generating an auth URL implies authenticating via web,
    // which should always use the service ID.
    url.searchParams.set('client_id', this.config.serviceId);

    if (options.state) {
      url.searchParams.set('state', options.state);
    }
    return url.toString();
  }

  generateToken(clientId) {
    const { teamId, keyId, privateKey } = this.config;
    const claims = {
      iss: teamId,
      sub: clientId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ( 86400 * 180 ), // 6 months
      aud: 'https://appleid.apple.com',
    };
    return new Promise((resolve, reject) => {
      jwt.sign(claims, privateKey, {
        algorithm: 'ES256',
        keyid: keyId,
      }, (err, token) => {
        if (err) {
          reject(err);
        } else {
          resolve(token);
        }
      });
    });
  }

  async validateCode(options) {
    const clientId = this.getClientId(options.app);
    const token = await this.generateToken(clientId);
    const payload = new URLSearchParams();
    payload.append('code', options.code);
    payload.append('client_id', clientId);
    payload.append('client_secret', token);
    payload.append('grant_type', 'authorization_code');
    payload.append('redirect_uri', this.config.redirectUri);
    const response = await fetch(APPLE_VALIDATE_URL, {
      method: 'POST',
      body: payload,
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    const { email, aud: authId } = jwt.decode(data.id_token);
    return { email, authId };
  }

}

module.exports = {
  OAuth2Client,
};
