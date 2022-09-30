let authStrategy;
// Encryption & Tokens
const Cryptr = require('cryptr');
const jwt = require('jsonwebtoken');

// Cryptr
const cryptr = new Cryptr(process.env.CRYPTR_SECRET_KEY);
const secret = process.env.JWT_TOKEN_SECRET;

// The below is a function that will decode the crypted JWT Token, then decode the jwt token and return the id
const decodeToken = function (cryptrToken) {
  // Express headers are auto converted to lowercase
  if (!cryptrToken) {
    return 'No token found';
  } else {
    // In a try and catch so if id is not encrypted it doesn't fail
    try {
      // decrypts token
      const decryptedToken = cryptr.decrypt(cryptrToken);

      // decodes jwt token
      const decodedToken = jwt.verify(
        decryptedToken,
        secret,
        function (err, decoded) {
          if (err) {
            return 'No valid token';
          } else {
            return decoded;
          }
        }
      );

      return decodedToken;
    } catch (error) {
      console.log(error);
      return cryptrToken;
    }
  }
};

const parseAuthTokenFromHeaders = req => {
  if (!req.headers) {
    return null;
  }

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) {
    return null;
  }

  const [token] = req.headers['authorization'].split(' ');
  return token;
};


module.exports = {
  setUserAuthStrategy: strat => {
    authStrategy = strat;
  },
  validateUser: async (emailAddress, password) => {
    return await authStrategy.validate({
      emailAddress,
      password,
    });
  },
  parseAuthTokenFromHeaders,

  retrieveJWTAuthedSession: (req, res, next) => {
    const authToken = parseAuthTokenFromHeaders(req);
    if (!authToken) {
      return next();
    }

    //const decodeResponse = jwt.decode(authToken, COOKIE_SECRET, false, 'HS256');
    const decodeResponse = decodeToken(authToken);
    // just need to assign a user object with the id
    req.user = {
      id: decodeResponse.id,
    };
    next();
  },

  checkAuthenticated: (req, res, next) => {
    if (!req.user) {
      return res.status(401).send({ err: 'user not logged in' });
    }
    next();
  },
};
