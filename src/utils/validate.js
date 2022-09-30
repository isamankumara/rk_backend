const validateRequest = (schema) => async (req, res, next) => {
  const {error} = schema.validate(req.body);

  if (error) {
    res.status(400).send({
      message: error.message
    })
    throw new Error
  };

  return next();
};

module.exports = {
  validateRequest
};