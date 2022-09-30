const { gql } = require('apollo-server-express');
const {
  getItem: keystoneGetItem,
  getItems: keystoneGetItems,
  createItem: keystoneCreateItem,
  createItems: keystoneCreateItems,
  deleteItem: keystoneDeleteItem,
  deleteItems: keystoneDeleteItems,
  updateItem: keystoneUpdateItem,
} = require('@keystonejs/server-side-graphql-client');

let keystone, context;

const setKeystone = keystoneInstance => {
  keystone = keystoneInstance;
  context = keystone.createContext();
};

const getItems = async (listKey, where, returnFields) => {
  return await keystoneGetItems({
    keystone,
    listKey,
    returnFields,
    where,
  });
};

const getItem = async (listKey, itemId, returnFields) => {
  return await keystoneGetItem({
    keystone,
    listKey,
    itemId,
    returnFields,
  });
};

const createItem = async (listKey, item, returnFields) => {
  return await keystoneCreateItem({
    keystone,
    listKey,
    item,
    returnFields,
  });
};

const createItems = async (listKey, items, returnFields) => {
  return await keystoneCreateItems({
    keystone,
    listKey,
    items,
    returnFields,
  });
};

const deleteItem = async (listKey, itemId) => {
  return await keystoneDeleteItem({
    keystone,
    listKey,
    itemId,
  });
};

const deleteItems = async (listKey, items) => {
  return await keystoneDeleteItems({
    keystone,
    listKey,
    items,
  });
};

// data in form: : { name: 'newName' }
const updateItem = async (listKey, id, data, returnFields) => {
  return await keystoneUpdateItem({
    keystone,
    listKey,
    item: { id, data },
    returnFields,
  });
};

const executeGQLWithAuthedItem = async (query, contextItem, listKey) => {
  const { data, errors } = await keystone.executeGraphQL({
    context: context.createContext({
      authentication: { item: contextItem, listKey: listKey },
    }),
    query: gql`
      ${query}
    `,
  });
  if (errors) throw errors;
  return data;
};

const executeGQL = async query => {
  const { data, errors } = await keystone.executeGraphQL({
    context,
    query: gql`
      ${query}
    `,
  });
  if (errors) throw errors;
  return data;
};

const one2ManyGQLExpand = oneToMany => {
  return oneToMany.map(one => {
    return { id: one };
  });
};

module.exports = {
  setKeystone,
  getItem,
  getItems,
  createItem,
  createItems,
  deleteItem,
  deleteItems,
  updateItem,
  executeGQL,
  executeGQLWithAuthedItem,
  one2ManyGQLExpand,
};
