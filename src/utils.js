function encodeState(state) {
  return Buffer.from(JSON.stringify(state)).toString('base64');
}

function decodeState(str) {
  return str ? JSON.parse(Buffer.from(str, 'base64').toString()) : null;
}

module.exports = {
  encodeState,
  decodeState,
};
