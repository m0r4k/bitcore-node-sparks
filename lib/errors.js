'use strict';

var createError = require('errno').create;

var sparkscoreNodeError = createError('sparkscoreNodeError');

var RPCError = createError('RPCError', sparkscoreNodeError);

module.exports = {
  Error: sparkscoreNodeError,
  RPCError: RPCError
};
