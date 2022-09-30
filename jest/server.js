require('dotenv/config'); // this is needed for local runs

const express = require('express');
const { keystone, configureExpress, adapter } = require('../src/index.js');
const { GraphQLApp } = require('@keystonejs/app-graphql');

const server = keystone
  .prepare({
    apps: [new GraphQLApp()], // ignore admin app since it causes jest teardown issues
    dev: process.env.NODE_ENV !== 'production',
  })
  .then(async ({ middlewares }) => {
    try {
      await keystone.connect();
    } catch (err) {
      console.error(err);
    }
    const app = express();
    configureExpress(app);
    return app.use(middlewares).listen(0);
  })
  .catch(err => {
    console.error(err);
  });

const dropTestDB = () => {
  return adapter.dropDatabase();
};

module.exports = { server, keystone, dropTestDB };
