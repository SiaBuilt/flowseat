const cloud = require('wx-server-sdk');
const { createHandler } = require('./handler');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = async event => createHandler({
  db: cloud.database(), context: cloud.getWXContext(), env: process.env,
  log: error => console.error('API_FAILURE', error.code || error.name || 'unknown')
})(event);
