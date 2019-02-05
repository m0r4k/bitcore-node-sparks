'use strict';

var should = require('chai').should();
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var SparksService = require('../../lib/services/sparksd');
var index = require('../../lib');
var log = index.log;

describe('#start', function() {

  var sandbox = sinon.sandbox.create();
  beforeEach(function() {
    sandbox.stub(log, 'error');
  });
  afterEach(function() {
    sandbox.restore();
  });

  describe('will dynamically create a node from a configuration', function() {

    it('require each sparkscore-node service with default config', function(done) {
      var node;
      var TestNode = function(options) {
        options.services[0].should.deep.equal({
          name: 'sparksd',
          module: SparksService,
          config: {
            spawn: {
              datadir: './data'
            }
          }
        });
      };
      TestNode.prototype.start = sinon.stub().callsArg(0);
      TestNode.prototype.on = sinon.stub();
      TestNode.prototype.chain = {
        on: sinon.stub()
      };

      var starttest = proxyquire('../../lib/scaffold/start', {
        '../node': TestNode
      });

      starttest.registerExitHandlers = sinon.stub();

      node = starttest({
        path: __dirname,
        config: {
          services: [
            'sparksd'
          ],
          servicesConfig: {
            sparksd: {
              spawn: {
                datadir: './data'
              }
            }
          }
        }
      });
      node.should.be.instanceof(TestNode);
      done();
    });
    it('shutdown with an error from start', function(done) {
      var TestNode = proxyquire('../../lib/node', {});
      TestNode.prototype.start = function(callback) {
        setImmediate(function() {
          callback(new Error('error'));
        });
      };
      var starttest = proxyquire('../../lib/scaffold/start', {
        '../node': TestNode
      });
      starttest.cleanShutdown = sinon.stub();
      starttest.registerExitHandlers = sinon.stub();

      starttest({
        path: __dirname,
        config: {
          services: [],
          servicesConfig: {}
        }
      });
      setImmediate(function() {
        starttest.cleanShutdown.callCount.should.equal(1);
        done();
      });
    });
    it('require each sparkscore-node service with explicit config', function(done) {
      var node;
      var TestNode = function(options) {
        options.services[0].should.deep.equal({
          name: 'sparksd',
          module: SparksService,
          config: {
            param: 'test',
            spawn: {
              datadir: './data'
            }
          }
        });
      };
      TestNode.prototype.start = sinon.stub().callsArg(0);
      TestNode.prototype.on = sinon.stub();
      TestNode.prototype.chain = {
        on: sinon.stub()
      };

      var starttest = proxyquire('../../lib/scaffold/start', {
        '../node': TestNode
      });
      starttest.registerExitHandlers = sinon.stub();

      node = starttest({
        path: __dirname,
        config: {
          services: [
            'sparksd'
          ],
          servicesConfig: {
            'sparksd': {
              param: 'test',
              spawn: {
                datadir: './data'
              }
            }
          },

        }
      });
      node.should.be.instanceof(TestNode);
      done();
    });
  });
});
