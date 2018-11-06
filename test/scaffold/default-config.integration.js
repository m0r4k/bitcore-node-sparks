'use strict';

var path = require('path');
var should = require('chai').should();
var sinon = require('sinon');
var proxyquire = require('proxyquire');

describe('#defaultConfig', function() {
  var expectedExecPath = path.resolve(__dirname, process.env.HOME, './.sparkscore/data/sparksd');

  it('will return expected configuration', function() {
    var config = JSON.stringify({
      network: 'livenet',
      port: 3001,
      services: [
        'sparksd',
        'web'
      ],
      servicesConfig: {
        sparksd: {
          connect: [{
            rpchost: '127.0.0.1',
            rpcport: 9998,
            rpcuser: 'sparks',
            rpcpassword: 'local321',
            zmqpubrawtx: 'tcp://127.0.0.1:28332'
           }]
        }
      }
    }, null, 2);
    var defaultConfig = proxyquire('../../lib/scaffold/default-config', {
      fs: {
        existsSync: sinon.stub().returns(false),
        writeFileSync: function(path, data) {
          path.should.equal(process.env.HOME + '/.sparkscore/sparkscore-node.json');
          data.should.equal(config);
        },
        readFileSync: function() {
          return config;
        }
      },
      mkdirp: {
        sync: sinon.stub()
      }
    });
    var home = process.env.HOME;
    var info = defaultConfig();
    info.path.should.equal(home + '/.sparkscore');
    info.config.network.should.equal('livenet');
    info.config.port.should.equal(3001);
    info.config.services.should.deep.equal(['sparksd', 'web']);
    var sparksd = info.config.servicesConfig.sparksd;
    should.exist(sparksd);
  });
  it('will include additional services', function() {
    var config = JSON.stringify({
      network: 'livenet',
      port: 3001,
      services: [
        'sparksd',
        'web',
        'insight-api-sparks',
        'insight-ui-sparks'
      ],
      servicesConfig: {
        sparksd: {
          connect: [{
            rpchost: '127.0.0.1',
            rpcport: 9998,
            rpcuser: 'sparks',
            rpcpassword: 'local321',
            zmqpubrawtx: 'tcp://127.0.0.1:28332'
          }]
        }
      }
    }, null, 2);
    var defaultConfig = proxyquire('../../lib/scaffold/default-config', {
      fs: {
        existsSync: sinon.stub().returns(false),
        writeFileSync: function(path, data) {
          path.should.equal(process.env.HOME + '/.sparkscore/sparkscore-node.json');
          data.should.equal(config);
        },
        readFileSync: function() {
          return config;
        }
      },
      mkdirp: {
        sync: sinon.stub()
      }
    });
    var home = process.env.HOME;
    var info = defaultConfig({
      additionalServices: ['insight-api-sparks', 'insight-ui-sparks']
    });
    info.path.should.equal(home + '/.sparkscore');
    info.config.network.should.equal('livenet');
    info.config.port.should.equal(3001);
    info.config.services.should.deep.equal([
      'sparksd',
      'web',
      'insight-api-sparks',
      'insight-ui-sparks'
    ]);
    var sparksd = info.config.servicesConfig.sparksd;
    should.exist(sparksd);
  });
});
