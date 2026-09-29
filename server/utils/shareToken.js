const crypto = require("crypto");

// 24 random bytes give a 192-bit token. It is cryptographically secure and
// unrelated to the collection id, so public links cannot be guessed or
// walked by incrementing an id.
const SHARE_TOKEN_BYTES = 24;

const createShareToken = () =>
  crypto.randomBytes(SHARE_TOKEN_BYTES).toString("base64url");

module.exports = { createShareToken };
