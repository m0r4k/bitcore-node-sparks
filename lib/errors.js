'use strict';

var createError = require('errno').create;

var SparkscoreNodeError = createError('SparkscoreNodeError');

var RPCError = createError('RPCError', SparkscoreNodeError);

module.exports = {
  Error: SparkscoreNodeError,
  RPCError: RPCError
};
