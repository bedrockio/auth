# @bedrockio/auth

## Installation

```bash
npm install @bedrockio/auth
```

## Setup

First we need to set up credentials for the new OAuth 2.0 flow we want to create.

### Google

To setup Google authentication, first go to [APIs & Services > Credentials > Create Credentials > OAuth Client ID](https://console.cloud.google.com/apis/credentials/oauthclient) for your project.

- Choose "Web Application" for the application type.
- Give it a name for identification.
- "Authorized Javascript origins" is not required as this setup is for a standard web redirect flow.
- Add an "Authorized Redirect URI" that will be your new API route, which you will set up below. For example `https://api.mysite.com/1/auth/google`.
- For local testing also add a local URL like `http://localhost:2300/1/auth/google`.

Take note of the "Client ID" and "Client secret" and add them to your `.env` file along with the "Authorized Redirect URI" you added:

```
GOOGLE_OAUTH_CLIENT_ID=my-client-id
GOOGLE_OAUTH_CLIENT_SECRET=my-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:2300/1/auth/google
```

## Usage

This package exports middleware for use with a Bedrock route based on Koa. To use, simply create a new route and add it to the middleware for that route:

```js
const { googleAuthMiddleware } = require('@bedrockio/auth');
const router = new Router();
router.get(
  '/google',
  googleAuthMiddleware({
    clientId,
    clientSecret,
    redirectUri,
  }),
  async (ctx) => {
    const { email, names, returnUrl } = ctx.state.oAuthInfo;
    let user = await User.findOne({
      email,
      deletedAt: {
        $exists: false,
      },
    });
    if (!user) {
      user = await User.create({
        email,
        name: [names.firstName, names.givenName].join(' '),
      });
    }
    const token = tokens.createUserToken(user);
    if (returnUrl) {
      const url = new URL(returnUrl, APP_URL);
      url.searchParams.append('token', token);
      ctx.redirect(url);
    } else {
      ctx.body = { data: { token } };
    }
  }
);
```

The above code is boilerplate but will work with a Bedrock project out of the box and should not require changes. The middleware handles OAuth 2.0 redirects and the above code will only be called when the authentication flow is completed. Using `localhost` as an example:

- `GET http://localhost:2300/1/auth/google`
- Redirects to `https://accounts.google.com/`
- Authentication commences. The first time they authenticate with your app they will see an "Allow Access" consent screen. This can be configured by going to [OAuth consent screen configuration](https://console.cloud.google.com/apis/credentials/consent) for your project.
- From there authenticaion may involve a password or two-factor step, "choose account" dialog or full signup depending on how the user authenticates.
- Redirects back to `http://localhost:2300/1/auth/google?code=access_code`
- Middleware validates the access code and receives the email and names for the authenticated user.
- Validated information is set as `ctx.state.oAuthInfo`.
- Middleware hands off to your route handler.

From here your app can handle as needed. `oAuthInfo` contains:

- `email` - The validated email address of the authenticated user. This will always be set.
- `names` - An object containing the names of the user.
  - `givenName` - ???
  - `familyName` - ???
  - `displayName` - ???
  - `displayNameLastFirst`: ???
  - `unstructuredName`: ???
