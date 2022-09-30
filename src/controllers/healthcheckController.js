const { redisPing } = require('../utils/RedisUtil');
const { executeGQL } = require('./GQL');

// Get All Questions
async function healthcheck(req, res) {
  try {
    // redis check
    const redisResponse = await redisPing();
    if (redisResponse.toString() !== 'PONG') throw 'Unable to reach redis';

    // db check -- can we do a better check than this ?
    const result = await executeGQL(` 
      query {
        _allUsersMeta {
          count
        }
      }`);
    if (!Number.isInteger(result._allUsersMeta.count))
      throw 'Database is not connected';

    res.status(200).send('All healthy');
  } catch (error) {
    console.error('healthcheck ', error);
    res.status(500).send(`Healthcheck failed with error ${error}`);
  }
}

module.exports = {
  healthcheck,
};
