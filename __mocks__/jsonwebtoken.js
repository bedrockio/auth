const jwt = jest.requireActual('jsonwebtoken');

module.exports = {
  sign: (payload, privateKey, options, cb) => {
    cb(null, 'fake signed key');
  },
  decode: (str) => {
    return jwt.decode(str);
  },
};
