// Encryption & Tokens
const Cryptr = require('cryptr');
const jwt = require('jsonwebtoken');

// Cryptr
const cryptr = new Cryptr(process.env.CRYPTR_SECRET_KEY);
const secret = process.env.JWT_TOKEN_SECRET;

const encryptID = async function (id) {
  // Create and assign token
  let token = jwt.sign({ id }, secret);

  // Encrypt token with Cryptr - to decrypt run bcrypt
  const encryptedToken = cryptr.encrypt(token);

  return encryptedToken;
};

module.exports = { encryptID };
