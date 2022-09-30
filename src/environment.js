process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});
require('@google-cloud/debug-agent').start({
  serviceContext: { enableCanary: true },
});
const { exec: execDev } = require('@keystonejs/keystone/bin/commands/dev');
const { exec: execStart } = require('@keystonejs/keystone/bin/commands/start');
const { getSecretByName } = require('./utils/SecretUtil');

const { SECRET_PREFIX, CONFIG_ENV, NODE_ENV, PRINT_VARS } = process.env;

const setEnvVars = varNames => {
  return Promise.all(varNames.map(varName => setEnvVar(varName)));
};

const setEnvVar = async varName => {
  process.env[varName] = await getSecretByName(
    `${SECRET_PREFIX}/${CONFIG_ENV}_${varName}/versions/latest`
  );
};

// lookup environment variables and inject into process env
(async () => {
  const environment = [
    'DB_CONNECTION',
    'REDIS_HOST',
    'REDIS_PORT',
    'CRYPTR_SECRET_KEY',
    'JWT_TOKEN_SECRET',
    'COOKIE_SECRET',
    'AWS_ACCESS_KEY',
    'AWS_SECRET_ACCESS_KEY',
    'OPERATIONAL_BUCKET',
    'MEDIA_ASSET_SOURCE_BUCKET',
    'QUESTION_BUNDLES_BUCKET',
    'GOOGLE_CLIENT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
    'CONTENT_SYNC_SPREADSHEET_IDENTIFIERS',
    'INITIALISE_ORGS',
    'CONTENT_SYNC_TABS',
    'EMAIL_ADDRESS',
    'EMAIL_ADDRESS_APP_PASSWORD',
    'STORY_FINALISATION_POLICY',
    'BANDWIDTH_BENCHMARK',
    'AUDIO_SAMPLE_RATE',
    'SYSTEM_EVENT_EMAILS',
    'AWS_PRESIGN_EXPIRE_SECONDS',
    'BACKEND_TASKS_BASE_ROUTE'
  ];

  await setEnvVars(environment);

  // set backend base route
  process.env.BASE_ROUTE = `https://${process.env.GAE_SERVICE}-dot-alifelived.ts.r.appspot.com`;
  environment.push('BASE_ROUTE');
  process.env.VERSION_BASE_ROUTE = `https://${process.env.GAE_VERSION}-dot-${process.env.GAE_SERVICE}-dot-alifelived.ts.r.appspot.com`;
  environment.push('VERSION_BASE_ROUTE');

  // is this a printvar run?
  if (PRINT_VARS === 'true') {
    console.log('==== environment start ====');
    for (const v of environment) {
      console.log(`${v}=${process.env[v]}`);
    }
    console.log('==== environment end ====');
  }

  // start keystone according to the node env
  const args = {};
  args['--entry'] = './all-dist/src/index.js'; // set entrypoint
  if (NODE_ENV === 'production') {
    args['_'] = [null, null];
    execStart(
      args,
      { exeName: 'start' },
      {
        succeed: txt => {
          console.log(txt);
        },
        start: txt => {
          console.log(txt);
        },
      }
    );
  } else {
    execDev(
      args,
      { exeName: 'dev' },
      {
        succeed: txt => {
          console.log(txt);
        },
        start: txt => {
          console.log(txt);
        },
      }
    );
  }
})().catch(e => {
  console.error('Failed to set environment with error ', e);
});
