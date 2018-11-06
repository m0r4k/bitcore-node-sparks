'use strict';

var path = require('path');

/**
 * Will return the path and default sparkscore-node configuration on environment variables
 * or default locations.
 * @param {Object} options
 * @param {String} options.network - "testnet" or "livenet"
 * @param {String} options.datadir - Absolute path to sparks database directory
 */
function getDefaultBaseConfig(options) {
  if (!options) {
    options = {};
  }

  var datadir = options.datadir || path.resolve(process.env.HOME, '.sparks');

  return {
    path: process.cwd(),
    config: {
      network: options.network || 'livenet',
      port: 3001,
      services: ['sparksd', 'web'],
      servicesConfig: {
        sparksd: {
          spawn: {
            datadir: datadir,
            exec: path.resolve(__dirname, datadir, 'sparksd')
          }
        }
      }
    }
  };
}

module.exports = getDefaultBaseConfig;
