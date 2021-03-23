# @bedrockio/auth

This package contains middleware to enable Google or Apple ID sign-in for a Bedrock project.

## Installation

```bash
npm install @bedrockio/auth
```

## Setup

First we need to set up credentials for the new OAuth 2.0 flow we want to create.

---

## Google

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

---

## Apple

Setup for Apple is a bit more involved. This middleware handles authentication with Apple ID for both iOS and web apps, however the setup process is somewhat different for each. A visual guide for setting up web authentication can be found [here](https://github.com/ananay/apple-auth/blob/master/SETUP.md).

- Create a new Apple developer account and take note of the team id.
- Set up a Primary App ID under "Identifiers" > "App IDs".
- If setting up an iOS app, add "Sign in with Apple" and take note of the app ID.
- If setting up for web, create a new Service ID under "Identifiers" > "Service IDs". This should configure "Sign In with Apple ID", point to the Primary App ID, and have domains and Return URLs properly set up.
- Note that "Return URLs" must be HTTPS, so local testing can be difficult. Cloudflare provides a [tunneling service](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/create-tunnel) that can help here but requires an account.
- Create a new key under "Keys". It will need to be enabled for "Sign in with Apple" and point to the Primary App ID. Download the key and take note of the key ID.

You will need to take note of the various settings you created and add them to your `.env` file:

```bash
APPLE_TEAM_ID=team-id
APPLE_APP_ID=app-id # (ios only)
APPLE_SERVICE_ID=service-id # (web only)
APPLE_REDIRECT_URI=redirect-uri # (web only)
APPLE_PRIVATE_KEY_ID=private-key-id

# Do not commit this file to your repo!
APPLE_PRIVATE_KEY=path/to/key.p8
```

## Usage

This package exports middleware for use with a Koa router. To use, simply create a new route and add it to the middleware for that route:

```js
const Router = require('@koa/router');
const User = require('../models/user');
const tokens = require('../utils/tokens');
const { googleAuthMiddleware, appleAuthMiddleware } = require('@bedrockio/auth');

const router = new Router();

// Google authentication can be done via GET only.
router.get(
  '/google',
  googleAuthMiddleware({
    clientId,
    clientSecret,
    redirectUri,
  }),
  handleSocialLogin
);

// Apple ID authentication flow involves a POST request, so the router
// must handle multiple methods. The middleware will handle GET and POST requests and throw a 405 for anything else.
router.all(
  '/apple',
  appleAuthMiddleware({
    keyId,
    appId,
    teamId,
    serviceId,
    redirectUri,
    // Note that this config can be either text or a path to a file.
    privateKey,
  }),
  handleSocialLogin
);

async function handleSocialLogin(ctx) {
  // Collect data from the `authInfo` object on the state.
  const { email, names, provider, authId, returnUrl } = ctx.state.authInfo;

  // Find the user for this email if they exist. Note that
  // the provided email is validated via a signed JWT token,
  // so is verified at this point.
  let user = await User.findOne({
    email,
    deletedAt: {
      $exists: false,
    },
  });
  if (user) {
    // If a user exists, check to see if they have authenticated
    // via this provider previously and if not add it to the providers
    // array.

    // Adding a field like this to your user model may not be required,
    // but is useful to show which authentication providers the user has
    // connected.
    const authProviderExists = user.authProviders.some((ap) => {
      return ap.provider === provider && ap.authId === authId;
    });
    if (!authProviderExists) {
      user.authProviders.push({
        authId,
        provider,
      });
      await user.save();
    }
  } else {
    if (!names.firstName || !names.lastName) {
      // Once a user has authenticated with Apple ID, names will no longer
      // be provided until the user has disconnected their account via
      // https://appleid.apple.com.

      // The user object should exist at this point, so this state should
      // not be possible in production, however it needs to be handled for
      // local development and environments where the database users may
      // become disconnected.
      ctx.throw(400, 'Provider names do not exist');
    }

    // Finally, create the user if they do not exist, adding this provider
    // to their connection list.
    user = await User.create({
      email,
      name: [names.firstName, names.lastName].join(' '),
      authIds: [
        {
          authId,
          provider,
        },
      ],
    });
  }
}
```

The above code is boilerplate but will work with a Bedrock project out of the box. The middleware handles OAuth 2.0 redirects and the above code will only be called when the authentication flow is completed. Example using `localhost`:

- `GET http://localhost:2300/1/auth/google`
- Redirects to `https://accounts.google.com/`
- Authentication commences. The first time they authenticate with your app they will see an "Allow Access" consent screen. This can be configured by going to [OAuth consent screen configuration](https://console.cloud.google.com/apis/credentials/consent) for your project.
- From there, authentication may involve a password or multi-factor step, "choose account" dialog, or full signup depending on how the user authenticates.
- Redirects back to `http://localhost:2300/1/auth/google?code=access_code` (Apple will perform a POST here instead)
- Middleware validates the access code and receives the email and names for the authenticated user.
- Validated information is set as `ctx.state.authInfo`.
- Middleware hands off to your route handler.

---

## AuthInfo

The `authInfo` object returned on `ctx.state` will contain the following values:

- `email` - The validated email address of the authenticated user. In the case of Apple this may be a proxy email if the user has opted out of providing their real email.
- `authId` - An ID that maps to the `aud` "audience claim" of the JWT token. This will disntinguish the authentication method specific to the app you set up in the setup step.
- `provider` - A string identifying the provider, either `apple` or `google`.
- `names` - An object containing the names of the user. Note that Apple only populates names on first authentication, and this will not exist on subsequent authenication calls. To reset this you must go to [appleid.apple.com](https://appleid.apple.com/) and remove your app from the list of authentication methods. The `names` object may differ depending on the service:
  - `firstName` - Provided by Apple, copied from `givenName` for Google.
  - `lastName` - Provided by Apple, copied from `familyName` for Google.
  - `givenName` - Google only.
  - `familyName` - Google only.
  - `displayName` - Google only.
  - `displayNameLastFirst`: Google only.
  - `unstructuredName`: Google only.
