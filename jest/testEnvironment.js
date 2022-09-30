require('dotenv/config');

// map test db conn and op db
if (process.env.NODE_ENV === 'test') {
  process.env.DB_CONNECTION = process.env.TEST_DB_CONNECTION;
  process.env.OPERATIONAL_BUCKET = process.env.TEST_OPERATIONAL_BUCKET;
  process.env.AWS_ACCESS_KEY = process.env.TEST_AWS_ACCESS_KEY;
  process.env.AWS_SECRET_ACCESS_KEY = process.env.TEST_AWS_SECRET_ACCESS_KEY;
  process.env.MEDIA_ASSET_SOURCE_BUCKET =
    process.env.TEST_MEDIA_ASSET_SOURCE_BUCKET;
  process.env.QUESTION_BUNDLES_BUCKET =
    process.env.TEST_QUESTION_BUNDLES_BUCKET;
  process.env.VERSION_BASE_ROUTE = '';
  process.env.BASE_ROUTE = '';
}
