const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const redisStore = require('connect-redis')(session);

require('dotenv/config');

const { Keystone } = require('@keystonejs/keystone');
const { PasswordAuthStrategy } = require('@keystonejs/auth-password');
const { GraphQLApp } = require('@keystonejs/app-graphql');
const { AdminUIApp } = require('@keystonejs/app-admin-ui');
const { MongooseAdapter: Adapter } = require('@keystonejs/adapter-mongoose');
const {
  initialiseOrganisations,
} = require('./services/content/helpers/ContentSyncHelper');

const { setKeystone } = require('./controllers/GQL');
const {
  setUserAuthStrategy,
  retrieveJWTAuthedSession,
  checkAuthenticated,
} = require('./utils/AuthUtil');
const {
  cleanupAudioChannels,
} = require('./services/audiochannel/helpers/AudioChannelLifecycleHelper');
const {
  cleanupRecordingStories,
} = require('./services/story/helpers/StoryLifecycleHelper');
const { redisClient, redisDeclutter } = require('./utils/RedisUtil');

// list schemas
const OrganisationSchema = require('./lists/OrganisationSchema');
const UserSchema = require('./lists/UserSchema');
const AdminSchema = require('./lists/AdminSchema');
const AudioChannelSchema = require('./lists/AudioChannelSchema');
const MediaAssetSchema = require('./lists/MediaAssetSchema');
const QuestionSchema = require('./lists/QuestionSchema');
const StorySchema = require('./lists/StorySchema');
const PlayableItemSchema = require('./lists/PlayableItemSchema');
const TagSchema = require('./lists/TagSchema');
const TopicSchema = require('./lists/TopicSchema');
const ThemeSchema = require('./lists/ThemeSchema');
const PlaylistSchema = require('./lists/PlaylistSchema');

const PROJECT_NAME = 'alifelived-backend';
const adapter = new Adapter({ mongoUri: process.env.DB_CONNECTION });
const keystone = new Keystone({
  name: PROJECT_NAME,
  adapter,
  onConnect: initialiseOrganisations,
  sessionStore: new redisStore({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    client: redisClient,
    ttl: 86400,
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Default to true in production, needs to be false for local testing
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    sameSite: false,
  },
  cookieSecret: process.env.COOKIE_SECRET,
});

// Creates lists
keystone.createList('Organisation', OrganisationSchema);
keystone.createList('User', UserSchema);
keystone.createList('Admin', AdminSchema);
keystone.createList('Topic', TopicSchema);
keystone.createList('Theme', ThemeSchema);
keystone.createList('AudioChannel', AudioChannelSchema);
keystone.createList('MediaAsset', MediaAssetSchema);
keystone.createList('Question', QuestionSchema);
keystone.createList('Story', StorySchema);
keystone.createList('PlayableItem', PlayableItemSchema);
keystone.createList('Tag', TagSchema);
keystone.createList('Playlist', PlaylistSchema);

const adminAuthStrategy = keystone.createAuthStrategy({
  type: PasswordAuthStrategy,
  list: 'Admin',
  config: {
    identityField: 'emailAddress',
    secretField: 'password',
  },
});

const userAuthStrategy = keystone.createAuthStrategy({
  type: PasswordAuthStrategy,
  list: 'User',
  config: {
    identityField: 'emailAddress',
    secretField: 'password',
  },
});

setKeystone(keystone);
setUserAuthStrategy(userAuthStrategy);

// Routes
const configureServer = app => {
  // Middleware to accept Body
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(express.static('/tmp'));
  app.set('trust proxy', 1);
  app.use(cors());

  app.use(['*/authed'], retrieveJWTAuthedSession); // sets req.user with just id
  app.use(['*/authed'], checkAuthenticated); // throws 401 if no session exists

  // new
  app.use('/story', require('./services/story/StoryRoutes'));
  app.use(
    '/playableitems',
    require('./services/playableitem/PlayableItemRoutes')
  );
  app.use('/content', require('./services/content/ContentRoutes'));
  app.use('/search', require('./services/search/SearchRoutes'));
  app.use('/topic', require('./services/topic/TopicRoutes'));
  app.use('/theme', require('./services/theme/ThemeRoutes'));
  app.use('/tag', require('./services/tag/TagRoutes'));
  app.use('/user', require('./services/user/UserRoutes'));
  app.use('/playlist', require('./services/playlist/PlaylistRoutes'));

  app.use(
    '/audiochannel',
    require('./services/audiochannel/AudioChannelRoutes')
  );

  // manual cleanup
  app.get('/cleanup', async function (req, res) {
    try {
      await cleanup();
      res.status(200).send();
    } catch (err) {
      console.error('cleanup ' + err);
      res.status(500).send(err);
    }
  });

  // noauth old
  app.use('/media', require('./routes/mediaAssets'));
  app.use('/healthcheck', require('./routes/healthcheck'));

  // authed old
  app.use('/authed/upload', require('./routes/imageUpload'));
  app.use('/authed/email', require('./routes/emailApi'));

  app.get('/_ah/start', async function (req, res) {
    res.status(200).send();
  });
  app.get('/_ah/stop', function (req, res) {
    res.status(200).send();
  });
};

// cleanup leftover artefacts of abandoned recording sessions or prior server/network failures
// this should be done at periods of low usage
// and ideally should only be done by one server (potentially migrate to serverless task)
const cleanup = async () => {
  try {
    console.log('Starting cleanup');
    const cleanupAge = process.env.CLEANUP_AGE_HRS
      ? process.env.CLEANUP_AGE_HRS
      : 12;
    const declutterArchivePolicy = process.env.DECLUTTER_ARCHIVE_POLICY
      ? process.env.DECLUTTER_ARCHIVE_POLICY
      : 'DELETE';
    await cleanupRecordingStories(cleanupAge, declutterArchivePolicy);
    await cleanupAudioChannels(cleanupAge, declutterArchivePolicy);
    await redisDeclutter(cleanupAge, declutterArchivePolicy);
    console.log('Finished cleanup');
  } catch (err) {
    console.error('cleanup ' + err);
  }
};

if (process.env.NODE_ENV !== 'test') {
  // maintenance tasks
  cron.schedule('0 */3 * * *', () => cleanup());
}

module.exports = {
  configureExpress: app => {
    configureServer(app);
  },
  keystone,
  adapter,
  apps: [
    new GraphQLApp(),
    new AdminUIApp({
      name: 'ALifeLived Admin',
      adminPath: '/admin',
      authStrategy: adminAuthStrategy,
    }),
  ],
};
