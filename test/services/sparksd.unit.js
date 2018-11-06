'use strict';

/* jshint sub: true */

var path = require('path');
var EventEmitter = require('events').EventEmitter;
var should = require('chai').should();
var crypto = require('crypto');
var sparkscore = require('@sparksevo/sparkscore-lib');
var _ = sparkscore.deps._;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var fs = require('fs');
var sinon = require('sinon');

var index = require('../../lib');
var log = index.log;
var errors = index.errors;

var Transaction = sparkscore.Transaction;
var readFileSync = sinon.stub().returns(fs.readFileSync(path.resolve(__dirname, '../data/sparks.conf')));
var sparksService = proxyquire('../../lib/services/sparksd', {
  fs: {
    readFileSync: readFileSync
  }
});
var defaultsparksConf = fs.readFileSync(path.resolve(__dirname, '../data/default.sparks.conf'), 'utf8');

describe('sparks Service', function() {
  var txhex = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0704ffff001d0104ffffffff0100f2052a0100000043410496b538e853519c726a2c91e61ec11600ae1390813a627c66fb8be7947be63c52da7589379515d4e0a604f8141781e62294721166bf621e73a82cbf2342c858eeac00000000';

  var baseConfig = {
    node: {
      network: sparkscore.Networks.testnet
    },
    spawn: {
      datadir: 'testdir',
      exec: 'testpath'
    }
  };

  describe('@constructor', function() {
    it('will create an instance', function() {
      var sparksd = new sparksService(baseConfig);
      should.exist(sparksd);
    });
    it('will create an instance without `new`', function() {
      var sparksd = sparksService(baseConfig);
      should.exist(sparksd);
    });
    it('will init caches', function() {
      var sparksd = new sparksService(baseConfig);
      should.exist(sparksd.utxosCache);
      should.exist(sparksd.txidsCache);
      should.exist(sparksd.balanceCache);
      should.exist(sparksd.summaryCache);
      should.exist(sparksd.transactionDetailedCache);
      should.exist(sparksd.masternodeListCache);

      should.exist(sparksd.transactionCache);
      should.exist(sparksd.rawTransactionCache);
      should.exist(sparksd.blockCache);
      should.exist(sparksd.rawBlockCache);
      should.exist(sparksd.blockHeaderCache);
      should.exist(sparksd.zmqKnownTransactions);
      should.exist(sparksd.zmqKnownBlocks);
      should.exist(sparksd.lastTip);
      should.exist(sparksd.lastTipTimeout);
    });
    it('will init clients', function() {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.should.deep.equal([]);
      sparksd.nodesIndex.should.equal(0);
      sparksd.nodes.push({client: sinon.stub()});
      should.exist(sparksd.client);
    });
    it('will set subscriptions', function() {
      var sparksd = new sparksService(baseConfig);
      sparksd.subscriptions.should.deep.equal({
        address: {},
        rawtransaction: [],
        hashblock: [],
        transactionlock: []
      });
    });
  });

  describe('#_initDefaults', function() {
    it('will set transaction concurrency', function() {
      var sparksd = new sparksService(baseConfig);
      sparksd._initDefaults({transactionConcurrency: 10});
      sparksd.transactionConcurrency.should.equal(10);
      sparksd._initDefaults({});
      sparksd.transactionConcurrency.should.equal(5);
    });
  });

  describe('@dependencies', function() {
    it('will have no dependencies', function() {
      sparksService.dependencies.should.deep.equal([]);
    });
  });

  describe('#getAPIMethods', function() {
    it('will return spec', function() {
      var sparksd = new sparksService(baseConfig);
      var methods = sparksd.getAPIMethods();
      should.exist(methods);
      methods.length.should.equal(23);
    });
  });

  describe('#getPublishEvents', function() {
    it('will return spec', function() {
      var sparksd = new sparksService(baseConfig);
      var events = sparksd.getPublishEvents();
      should.exist(events);
      events.length.should.equal(4);
      events[0].name.should.equal('sparksd/rawtransaction');
      events[0].scope.should.equal(sparksd);
      events[0].subscribe.should.be.a('function');
      events[0].unsubscribe.should.be.a('function');
      events[1].name.should.equal('sparksd/transactionlock');
      events[1].scope.should.equal(sparksd);
      events[1].subscribe.should.be.a('function');
      events[1].unsubscribe.should.be.a('function');
      events[2].name.should.equal('sparksd/hashblock');
      events[2].scope.should.equal(sparksd);
      events[2].subscribe.should.be.a('function');
      events[2].unsubscribe.should.be.a('function');
      events[3].name.should.equal('sparksd/addresstxid');
      events[3].scope.should.equal(sparksd);
      events[3].subscribe.should.be.a('function');
      events[3].unsubscribe.should.be.a('function');
    });
    it('will call subscribe/unsubscribe with correct args', function() {
      var sparksd = new sparksService(baseConfig);
      sparksd.subscribe = sinon.stub();
      sparksd.unsubscribe = sinon.stub();
      var events = sparksd.getPublishEvents();

      events[0].subscribe('test');
      sparksd.subscribe.args[0][0].should.equal('rawtransaction');
      sparksd.subscribe.args[0][1].should.equal('test');

      events[0].unsubscribe('test');
      sparksd.unsubscribe.args[0][0].should.equal('rawtransaction');
      sparksd.unsubscribe.args[0][1].should.equal('test');

      events[1].subscribe('test');
      sparksd.subscribe.args[1][0].should.equal('transactionlock');
      sparksd.subscribe.args[1][1].should.equal('test');

      events[1].unsubscribe('test');
      sparksd.unsubscribe.args[1][0].should.equal('transactionlock');
      sparksd.unsubscribe.args[1][1].should.equal('test');

      events[2].subscribe('test');
      sparksd.subscribe.args[2][0].should.equal('hashblock');
      sparksd.subscribe.args[2][1].should.equal('test');

      events[2].unsubscribe('test');
      sparksd.unsubscribe.args[2][0].should.equal('hashblock');
      sparksd.unsubscribe.args[2][1].should.equal('test');
    });
  });

  describe('#subscribe', function() {
    var sandbox = sinon.sandbox.create();
    beforeEach(function() {
      sandbox.stub(log, 'info');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('will push to subscriptions', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter = {};
      sparksd.subscribe('hashblock', emitter);
      sparksd.subscriptions.hashblock[0].should.equal(emitter);

      var emitter2 = {};
      sparksd.subscribe('rawtransaction', emitter2);
      sparksd.subscriptions.rawtransaction[0].should.equal(emitter2);
    });
  });

  describe('#unsubscribe', function() {
    var sandbox = sinon.sandbox.create();
    beforeEach(function() {
      sandbox.stub(log, 'info');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('will remove item from subscriptions', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter1 = {};
      var emitter2 = {};
      var emitter3 = {};
      var emitter4 = {};
      var emitter5 = {};
      sparksd.subscribe('hashblock', emitter1);
      sparksd.subscribe('hashblock', emitter2);
      sparksd.subscribe('hashblock', emitter3);
      sparksd.subscribe('hashblock', emitter4);
      sparksd.subscribe('hashblock', emitter5);
      sparksd.subscriptions.hashblock.length.should.equal(5);

      sparksd.unsubscribe('hashblock', emitter3);
      sparksd.subscriptions.hashblock.length.should.equal(4);
      sparksd.subscriptions.hashblock[0].should.equal(emitter1);
      sparksd.subscriptions.hashblock[1].should.equal(emitter2);
      sparksd.subscriptions.hashblock[2].should.equal(emitter4);
      sparksd.subscriptions.hashblock[3].should.equal(emitter5);
    });
    it('will not remove item an already unsubscribed item', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter1 = {};
      var emitter3 = {};
      sparksd.subscriptions.hashblock= [emitter1];
      sparksd.unsubscribe('hashblock', emitter3);
      sparksd.subscriptions.hashblock.length.should.equal(1);
      sparksd.subscriptions.hashblock[0].should.equal(emitter1);
    });
  });

  describe('#subscribeAddress', function() {
    var sandbox = sinon.sandbox.create();
    beforeEach(function() {
      sandbox.stub(log, 'info');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('will not an invalid address', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter = new EventEmitter();
      sparksd.subscribeAddress(emitter, ['invalidaddress']);
      should.not.exist(sparksd.subscriptions.address['invalidaddress']);
    });
    it('will add a valid address', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter = new EventEmitter();
      sparksd.subscribeAddress(emitter, ['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      should.exist(sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
    });
    it('will handle multiple address subscribers', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter1 = new EventEmitter();
      var emitter2 = new EventEmitter();
      sparksd.subscribeAddress(emitter1, ['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      sparksd.subscribeAddress(emitter2, ['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      should.exist(sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'].length.should.equal(2);
    });
    it('will not add the same emitter twice', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter1 = new EventEmitter();
      sparksd.subscribeAddress(emitter1, ['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      sparksd.subscribeAddress(emitter1, ['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      should.exist(sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'].length.should.equal(1);
    });
  });

  describe('#unsubscribeAddress', function() {
    var sandbox = sinon.sandbox.create();
    beforeEach(function() {
      sandbox.stub(log, 'info');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('it will remove a subscription', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter1 = new EventEmitter();
      var emitter2 = new EventEmitter();
      sparksd.subscribeAddress(emitter1, ['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      sparksd.subscribeAddress(emitter2, ['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      should.exist(sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'].length.should.equal(2);
      sparksd.unsubscribeAddress(emitter1, ['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'].length.should.equal(1);
    });
    it('will unsubscribe subscriptions for an emitter', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter1 = new EventEmitter();
      var emitter2 = new EventEmitter();
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'] = [emitter1, emitter2];
      sparksd.unsubscribeAddress(emitter1);
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'].length.should.equal(1);
    });
    it('will NOT unsubscribe subscription with missing address', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter1 = new EventEmitter();
      var emitter2 = new EventEmitter();
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'] = [emitter1, emitter2];
      sparksd.unsubscribeAddress(emitter1, ['XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs']);
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'].length.should.equal(2);
    });
    it('will NOT unsubscribe subscription with missing emitter', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter1 = new EventEmitter();
      var emitter2 = new EventEmitter();
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'] = [emitter2];
      sparksd.unsubscribeAddress(emitter1, ['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'].length.should.equal(1);
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'][0].should.equal(emitter2);
    });
    it('will remove empty addresses', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter1 = new EventEmitter();
      var emitter2 = new EventEmitter();
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'] = [emitter1, emitter2];
      sparksd.unsubscribeAddress(emitter1, ['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      sparksd.unsubscribeAddress(emitter2, ['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
      should.not.exist(sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi']);
    });
    it('will unsubscribe emitter for all addresses', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter1 = new EventEmitter();
      var emitter2 = new EventEmitter();
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'] = [emitter1, emitter2];
      sparksd.subscriptions.address['XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs'] = [emitter1, emitter2];
      sinon.spy(sparksd, 'unsubscribeAddressAll');
      sparksd.unsubscribeAddress(emitter1);
      sparksd.unsubscribeAddressAll.callCount.should.equal(1);
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'].length.should.equal(1);
      sparksd.subscriptions.address['XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs'].length.should.equal(1);
    });
  });

  describe('#unsubscribeAddressAll', function() {
    var sandbox = sinon.sandbox.create();
    beforeEach(function() {
      sandbox.stub(log, 'info');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('will unsubscribe emitter for all addresses', function() {
      var sparksd = new sparksService(baseConfig);
      var emitter1 = new EventEmitter();
      var emitter2 = new EventEmitter();
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'] = [emitter1, emitter2];
      sparksd.subscriptions.address['XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs'] = [emitter1, emitter2];
      sparksd.subscriptions.address['mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW'] = [emitter2];
      sparksd.subscriptions.address['7d5169eBcGHF4BYC6DTffTyeCpWbrZnNgz'] = [emitter1];
      sparksd.unsubscribeAddress(emitter1);
      sparksd.subscriptions.address['8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi'].length.should.equal(1);
      sparksd.subscriptions.address['XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs'].length.should.equal(1);
      sparksd.subscriptions.address['mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW'].length.should.equal(1);
      should.not.exist(sparksd.subscriptions.address['7d5169eBcGHF4BYC6DTffTyeCpWbrZnNgz']);
    });
  });

  describe('#_getDefaultConfig', function() {
    it('will generate config file from defaults', function() {
      var sparksd = new sparksService(baseConfig);
      var config = sparksd._getDefaultConfig();
      config.should.equal(defaultsparksConf);
    });
  });

  describe('#_loadSpawnConfiguration', function() {
    var sandbox = sinon.sandbox.create();
    beforeEach(function() {
      sandbox.stub(log, 'info');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('will parse a sparks.conf file', function() {
      var Testsparks = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFileSync: readFileSync,
          existsSync: sinon.stub().returns(true),
          writeFileSync: sinon.stub()
        },
        mkdirp: {
          sync: sinon.stub()
        }
      });
      var sparksd = new Testsparks(baseConfig);
      sparksd.options.spawn.datadir = '/tmp/.sparks';
      var node = {};
      sparksd._loadSpawnConfiguration(node);
      should.exist(sparksd.spawn.config);
      sparksd.spawn.config.should.deep.equal({
        addressindex: 1,
        checkblocks: 144,
        dbcache: 8192,
        maxuploadtarget: 1024,
        port: 20000,
        rpcport: 50001,
        rpcallowip: '127.0.0.1',
        rpcuser: 'sparks',
        rpcpassword: 'local321',
        server: 1,
        spentindex: 1,
        timestampindex: 1,
        txindex: 1,
        upnp: 0,
        whitelist: '127.0.0.1',
        zmqpubhashblock: 'tcp://127.0.0.1:28332',
        zmqpubrawtx: 'tcp://127.0.0.1:28332',
        zmqpubrawtxlock: 'tcp://127.0.0.1:28332'
      });
    });
    it('will expand relative datadir to absolute path', function() {
      var Testsparks = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFileSync: readFileSync,
          existsSync: sinon.stub().returns(true),
          writeFileSync: sinon.stub()
        },
        mkdirp: {
          sync: sinon.stub()
        }
      });
      var config = {
        node: {
          network: sparkscore.Networks.testnet,
          configPath: '/tmp/.sparkscore/sparkscore-node.json'
        },
        spawn: {
          datadir: './data',
          exec: 'testpath'
        }
      };
      var sparksd = new Testsparks(config);
      sparksd.options.spawn.datadir = './data';
      var node = {};
      sparksd._loadSpawnConfiguration(node);
      sparksd.options.spawn.datadir.should.equal('/tmp/.sparkscore/data');
    });
    it('should throw an exception if txindex isn\'t enabled in the configuration', function() {
      var Testsparks = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFileSync: sinon.stub().returns(fs.readFileSync(__dirname + '/../data/badsparks.conf')),
          existsSync: sinon.stub().returns(true),
        },
        mkdirp: {
          sync: sinon.stub()
        }
      });
      var sparksd = new Testsparks(baseConfig);
      (function() {
        sparksd._loadSpawnConfiguration({datadir: './test'});
      }).should.throw(sparkscore.errors.InvalidState);
    });
    it('should NOT set https options if node https options are set', function() {
      var writeFileSync = function(path, config) {
        config.should.equal(defaultsparksConf);
      };
      var Testsparks = proxyquire('../../lib/services/sparksd', {
        fs: {
          writeFileSync: writeFileSync,
          readFileSync: readFileSync,
          existsSync: sinon.stub().returns(false)
        },
        mkdirp: {
          sync: sinon.stub()
        }
      });
      var config = {
        node: {
          network: {
            name: 'regtest'
          },
          https: true,
          httpsOptions: {
            key: 'key.pem',
            cert: 'cert.pem'
          }
        },
        spawn: {
          datadir: 'testdir',
          exec: 'testexec'
        }
      };
      var sparksd = new Testsparks(config);
      sparksd.options.spawn.datadir = '/tmp/.sparks';
      var node = {};
      sparksd._loadSpawnConfiguration(node);
    });
  });

  describe('#_checkConfigIndexes', function() {
    var sandbox = sinon.sandbox.create();
    beforeEach(function() {
      sandbox.stub(log, 'warn');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('should warn the user if reindex is set to 1 in the sparks.conf file', function() {
      var sparksd = new sparksService(baseConfig);
      var config = {
        txindex: 1,
        addressindex: 1,
        spentindex: 1,
        server: 1,
        zmqpubrawtx: 1,
        zmqpubhashblock: 1,
        zmqpubrawtxlock: 1,
        reindex: 1
      };
      var node = {};
      sparksd._checkConfigIndexes(config, node);
      log.warn.callCount.should.equal(1);
      node._reindex.should.equal(true);
    });
    it('should warn if zmq port and hosts do not match', function() {
      var sparksd = new sparksService(baseConfig);
      var config = {
        txindex: 1,
        addressindex: 1,
        spentindex: 1,
        server: 1,
        zmqpubrawtx: 'tcp://127.0.0.1:28332',
        zmqpubhashblock: 'tcp://127.0.0.1:28331',
        zmqpubrawtxlock: 'tcp://127.0.0.1:28332',
        reindex: 1
      };
      var node = {};
      (function() {
        sparksd._checkConfigIndexes(config, node);
      }).should.throw('"zmqpubrawtx" and "zmqpubhashblock"');
    });
  });

  describe('#_resetCaches', function() {
    it('will reset LRU caches', function() {
      var sparksd = new sparksService(baseConfig);
      var keys = [];
      for (var i = 0; i < 10; i++) {
        keys.push(crypto.randomBytes(32));
        sparksd.transactionDetailedCache.set(keys[i], {});
        sparksd.utxosCache.set(keys[i], {});
        sparksd.txidsCache.set(keys[i], {});
        sparksd.balanceCache.set(keys[i], {});
        sparksd.summaryCache.set(keys[i], {});
      }
      sparksd._resetCaches();
      should.equal(sparksd.transactionDetailedCache.get(keys[0]), undefined);
      should.equal(sparksd.utxosCache.get(keys[0]), undefined);
      should.equal(sparksd.txidsCache.get(keys[0]), undefined);
      should.equal(sparksd.balanceCache.get(keys[0]), undefined);
      should.equal(sparksd.summaryCache.get(keys[0]), undefined);
    });
  });

  describe('#_tryAllClients', function() {
    it('will retry for each node client', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.tryAllInterval = 1;
      sparksd.nodes.push({
        client: {
          getInfo: sinon.stub().callsArgWith(0, new Error('test'))
        }
      });
      sparksd.nodes.push({
        client: {
          getInfo: sinon.stub().callsArgWith(0, new Error('test'))
        }
      });
      sparksd.nodes.push({
        client: {
          getInfo: sinon.stub().callsArg(0)
        }
      });
      sparksd._tryAllClients(function(client, next) {
        client.getInfo(next);
      }, function(err) {
        if (err) {
          return done(err);
        }
        sparksd.nodes[0].client.getInfo.callCount.should.equal(1);
        sparksd.nodes[1].client.getInfo.callCount.should.equal(1);
        sparksd.nodes[2].client.getInfo.callCount.should.equal(1);
        done();
      });
    });
    it('will start using the current node index (round-robin)', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.tryAllInterval = 1;
      sparksd.nodes.push({
        client: {
          getInfo: sinon.stub().callsArgWith(0, new Error('2'))
        }
      });
      sparksd.nodes.push({
        client: {
          getInfo: sinon.stub().callsArgWith(0, new Error('3'))
        }
      });
      sparksd.nodes.push({
        client: {
          getInfo: sinon.stub().callsArgWith(0, new Error('1'))
        }
      });
      sparksd.nodesIndex = 2;
      sparksd._tryAllClients(function(client, next) {
        client.getInfo(next);
      }, function(err) {
        err.should.be.instanceOf(Error);
        err.message.should.equal('3');
        sparksd.nodes[0].client.getInfo.callCount.should.equal(1);
        sparksd.nodes[1].client.getInfo.callCount.should.equal(1);
        sparksd.nodes[2].client.getInfo.callCount.should.equal(1);
        sparksd.nodesIndex.should.equal(0);
        done();
      });
    });
    it('will get error if all clients fail', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.tryAllInterval = 1;
      sparksd.nodes.push({
        client: {
          getInfo: sinon.stub().callsArgWith(0, new Error('test'))
        }
      });
      sparksd.nodes.push({
        client: {
          getInfo: sinon.stub().callsArgWith(0, new Error('test'))
        }
      });
      sparksd.nodes.push({
        client: {
          getInfo: sinon.stub().callsArgWith(0, new Error('test'))
        }
      });
      sparksd._tryAllClients(function(client, next) {
        client.getInfo(next);
      }, function(err) {
        should.exist(err);
        err.should.be.instanceOf(Error);
        err.message.should.equal('test');
        done();
      });
    });
  });

  describe('#_wrapRPCError', function() {
    it('will convert sparksd-rpc object into JavaScript error', function() {
      var sparksd = new sparksService(baseConfig);
      var error = sparksd._wrapRPCError({message: 'Test error', code: -1});
      error.should.be.an.instanceof(errors.RPCError);
      error.code.should.equal(-1);
      error.message.should.equal('Test error');
    });
  });

  describe('#_initChain', function() {
    var sandbox = sinon.sandbox.create();
    beforeEach(function() {
      sandbox.stub(log, 'info');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('will set height and genesis buffer', function(done) {
      var sparksd = new sparksService(baseConfig);
      var genesisBuffer = new Buffer([]);
      sparksd.getRawBlock = sinon.stub().callsArgWith(1, null, genesisBuffer);
      sparksd.nodes.push({
        client: {
          getBestBlockHash: function(callback) {
            callback(null, {
              result: 'bestblockhash'
            });
          },
          getBlock: function(hash, callback) {
            if (hash === 'bestblockhash') {
              callback(null, {
                result: {
                  height: 5000
                }
              });
            }
          },
          getBlockHash: function(num, callback) {
            callback(null, {
              result: 'genesishash'
            });
          }
        }
      });
      sparksd._initChain(function() {
        log.info.callCount.should.equal(1);
        sparksd.getRawBlock.callCount.should.equal(1);
        sparksd.getRawBlock.args[0][0].should.equal('genesishash');
        sparksd.height.should.equal(5000);
        sparksd.genesisBuffer.should.equal(genesisBuffer);
        done();
      });
    });
    it('it will handle error from getBestBlockHash', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBestBlockHash = sinon.stub().callsArgWith(0, {code: -1, message: 'error'});
      sparksd.nodes.push({
        client: {
          getBestBlockHash: getBestBlockHash
        }
      });
      sparksd._initChain(function(err) {
        err.should.be.instanceOf(Error);
        done();
      });
    });
    it('it will handle error from getBlock', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBestBlockHash = sinon.stub().callsArgWith(0, null, {});
      var getBlock = sinon.stub().callsArgWith(1, {code: -1, message: 'error'});
      sparksd.nodes.push({
        client: {
          getBestBlockHash: getBestBlockHash,
          getBlock: getBlock
        }
      });
      sparksd._initChain(function(err) {
        err.should.be.instanceOf(Error);
        done();
      });
    });
    it('it will handle error from getBlockHash', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBestBlockHash = sinon.stub().callsArgWith(0, null, {});
      var getBlock = sinon.stub().callsArgWith(1, null, {
        result: {
          height: 10
        }
      });
      var getBlockHash = sinon.stub().callsArgWith(1, {code: -1, message: 'error'});
      sparksd.nodes.push({
        client: {
          getBestBlockHash: getBestBlockHash,
          getBlock: getBlock,
          getBlockHash: getBlockHash
        }
      });
      sparksd._initChain(function(err) {
        err.should.be.instanceOf(Error);
        done();
      });
    });
    it('it will handle error from getRawBlock', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBestBlockHash = sinon.stub().callsArgWith(0, null, {});
      var getBlock = sinon.stub().callsArgWith(1, null, {
        result: {
          height: 10
        }
      });
      var getBlockHash = sinon.stub().callsArgWith(1, null, {});
      sparksd.nodes.push({
        client: {
          getBestBlockHash: getBestBlockHash,
          getBlock: getBlock,
          getBlockHash: getBlockHash
        }
      });
      sparksd.getRawBlock = sinon.stub().callsArgWith(1, new Error('test'));
      sparksd._initChain(function(err) {
        err.should.be.instanceOf(Error);
        done();
      });
    });
  });

  describe('#_getDefaultConf', function() {
    afterEach(function() {
      sparkscore.Networks.disableRegtest();
      baseConfig.node.network = sparkscore.Networks.testnet;
    });
    it('will get default rpc port for livenet', function() {
      var config = {
        node: {
          network: sparkscore.Networks.livenet
        },
        spawn: {
          datadir: 'testdir',
          exec: 'testpath'
        }
      };
      var sparksd = new sparksService(config);
      sparksd._getDefaultConf().rpcport.should.equal(9998);
    });
    it('will get default rpc port for testnet', function() {
      var config = {
        node: {
          network: sparkscore.Networks.testnet
        },
        spawn: {
          datadir: 'testdir',
          exec: 'testpath'
        }
      };
      var sparksd = new sparksService(config);
      sparksd._getDefaultConf().rpcport.should.equal(19998);
    });
    it('will get default rpc port for regtest', function() {
      sparkscore.Networks.enableRegtest();
      var config = {
        node: {
          network: sparkscore.Networks.testnet
        },
        spawn: {
          datadir: 'testdir',
          exec: 'testpath'
        }
      };
      var sparksd = new sparksService(config);
      sparksd._getDefaultConf().rpcport.should.equal(19998);
    });
  });

  describe('#_getNetworkConfigPath', function() {
    afterEach(function() {
      sparkscore.Networks.disableRegtest();
      baseConfig.node.network = sparkscore.Networks.testnet;
    });
    it('will get default config path for livenet', function() {
      var config = {
        node: {
          network: sparkscore.Networks.livenet
        },
        spawn: {
          datadir: 'testdir',
          exec: 'testpath'
        }
      };
      var sparksd = new sparksService(config);
      should.equal(sparksd._getNetworkConfigPath(), undefined);
    });
    it('will get default rpc port for testnet', function() {
      var config = {
        node: {
          network: sparkscore.Networks.testnet
        },
        spawn: {
          datadir: 'testdir',
          exec: 'testpath'
        }
      };
      var sparksd = new sparksService(config);
      sparksd._getNetworkConfigPath().should.equal('testnet3/sparks.conf');
    });
    it('will get default rpc port for regtest', function() {
      sparkscore.Networks.enableRegtest();
      var config = {
        node: {
          network: sparkscore.Networks.testnet
        },
        spawn: {
          datadir: 'testdir',
          exec: 'testpath'
        }
      };
      var sparksd = new sparksService(config);
      sparksd._getNetworkConfigPath().should.equal('regtest/sparks.conf');
    });
  });

  describe('#_getNetworkOption', function() {
    afterEach(function() {
      sparkscore.Networks.disableRegtest();
      baseConfig.node.network = sparkscore.Networks.testnet;
    });
    it('return --testnet for testnet', function() {
      var sparksd = new sparksService(baseConfig);
      sparksd.node.network = sparkscore.Networks.testnet;
      sparksd._getNetworkOption().should.equal('--testnet');
    });
    it('return --regtest for testnet', function() {
      var sparksd = new sparksService(baseConfig);
      sparksd.node.network = sparkscore.Networks.testnet;
      sparkscore.Networks.enableRegtest();
      sparksd._getNetworkOption().should.equal('--regtest');
    });
    it('return undefined for livenet', function() {
      var sparksd = new sparksService(baseConfig);
      sparksd.node.network = sparkscore.Networks.livenet;
      sparkscore.Networks.enableRegtest();
      should.equal(sparksd._getNetworkOption(), undefined);
    });
  });

  describe('#_zmqBlockHandler', function() {
    it('will emit block', function(done) {
      var sparksd = new sparksService(baseConfig);
      var node = {};
      var message = new Buffer('00000000002e08fc7ae9a9aa5380e95e2adcdc5752a4a66a7d3a22466bd4e6aa', 'hex');
      sparksd._rapidProtectedUpdateTip = sinon.stub();
      sparksd.on('block', function(block) {
        block.should.equal(message);
        done();
      });
      sparksd._zmqBlockHandler(node, message);
    });
    it('will not emit same block twice', function(done) {
      var sparksd = new sparksService(baseConfig);
      var node = {};
      var message = new Buffer('00000000002e08fc7ae9a9aa5380e95e2adcdc5752a4a66a7d3a22466bd4e6aa', 'hex');
      sparksd._rapidProtectedUpdateTip = sinon.stub();
      sparksd.on('block', function(block) {
        block.should.equal(message);
        done();
      });
      sparksd._zmqBlockHandler(node, message);
      sparksd._zmqBlockHandler(node, message);
    });
    it('will call function to update tip', function() {
      var sparksd = new sparksService(baseConfig);
      var node = {};
      var message = new Buffer('00000000002e08fc7ae9a9aa5380e95e2adcdc5752a4a66a7d3a22466bd4e6aa', 'hex');
      sparksd._rapidProtectedUpdateTip = sinon.stub();
      sparksd._zmqBlockHandler(node, message);
      sparksd._rapidProtectedUpdateTip.callCount.should.equal(1);
      sparksd._rapidProtectedUpdateTip.args[0][0].should.equal(node);
      sparksd._rapidProtectedUpdateTip.args[0][1].should.equal(message);
    });
    it('will emit to subscribers', function(done) {
      var sparksd = new sparksService(baseConfig);
      var node = {};
      var message = new Buffer('00000000002e08fc7ae9a9aa5380e95e2adcdc5752a4a66a7d3a22466bd4e6aa', 'hex');
      sparksd._rapidProtectedUpdateTip = sinon.stub();
      var emitter = new EventEmitter();
      sparksd.subscriptions.hashblock.push(emitter);
      emitter.on('sparksd/hashblock', function(blockHash) {
        blockHash.should.equal(message.toString('hex'));
        done();
      });
      sparksd._zmqBlockHandler(node, message);
    });
  });

  describe('#_rapidProtectedUpdateTip', function() {
    it('will limit tip updates with rapid calls', function(done) {
      var sparksd = new sparksService(baseConfig);
      var callCount = 0;
      sparksd._updateTip = function() {
        callCount++;
        callCount.should.be.within(1, 2);
        if (callCount > 1) {
          done();
        }
      };
      var node = {};
      var message = new Buffer('00000000002e08fc7ae9a9aa5380e95e2adcdc5752a4a66a7d3a22466bd4e6aa', 'hex');
      var count = 0;
      function repeat() {
        sparksd._rapidProtectedUpdateTip(node, message);
        count++;
        if (count < 50) {
          repeat();
        }
      }
      repeat();
    });
  });

  describe('#_updateTip', function() {
    var sandbox = sinon.sandbox.create();
    var message = new Buffer('00000000002e08fc7ae9a9aa5380e95e2adcdc5752a4a66a7d3a22466bd4e6aa', 'hex');
    beforeEach(function() {
      sandbox.stub(log, 'error');
      sandbox.stub(log, 'info');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('log and emit rpc error from get block', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.syncPercentage = sinon.stub();
      sparksd.on('error', function(err) {
        err.code.should.equal(-1);
        err.message.should.equal('Test error');
        log.error.callCount.should.equal(1);
        done();
      });
      var node = {
        client: {
          getBlock: sinon.stub().callsArgWith(1, {message: 'Test error', code: -1})
        }
      };
      sparksd._updateTip(node, message);
    });
    it('emit synced if percentage is 100', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.syncPercentage = sinon.stub().callsArgWith(0, null, 100);
      sparksd.on('synced', function() {
        done();
      });
      var node = {
        client: {
          getBlock: sinon.stub()
        }
      };
      sparksd._updateTip(node, message);
    });
    it('NOT emit synced if percentage is less than 100', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.syncPercentage = sinon.stub().callsArgWith(0, null, 99);
      sparksd.on('synced', function() {
        throw new Error('Synced called');
      });
      var node = {
        client: {
          getBlock: sinon.stub()
        }
      };
      sparksd._updateTip(node, message);
      log.info.callCount.should.equal(1);
      done();
    });
    it('log and emit error from syncPercentage', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.syncPercentage = sinon.stub().callsArgWith(0, new Error('test'));
      sparksd.on('error', function(err) {
        log.error.callCount.should.equal(1);
        err.message.should.equal('test');
        done();
      });
      var node = {
        client: {
          getBlock: sinon.stub()
        }
      };
      sparksd._updateTip(node, message);
    });
    it('reset caches and set height', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.syncPercentage = sinon.stub();
      sparksd._resetCaches = sinon.stub();
      sparksd.on('tip', function(height) {
        sparksd._resetCaches.callCount.should.equal(1);
        height.should.equal(10);
        sparksd.height.should.equal(10);
        done();
      });
      var node = {
        client: {
          getBlock: sinon.stub().callsArgWith(1, null, {
            result: {
              height: 10
            }
          })
        }
      };
      sparksd._updateTip(node, message);
    });
    it('will NOT update twice for the same hash', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.syncPercentage = sinon.stub();
      sparksd._resetCaches = sinon.stub();
      sparksd.on('tip', function() {
        done();
      });
      var node = {
        client: {
          getBlock: sinon.stub().callsArgWith(1, null, {
            result: {
              height: 10
            }
          })
        }
      };
      sparksd._updateTip(node, message);
      sparksd._updateTip(node, message);
    });
    it('will not call syncPercentage if node is stopping', function(done) {
      var config = {
        node: {
          network: sparkscore.Networks.testnet
        },
        spawn: {
          datadir: 'testdir',
          exec: 'testpath'
        }
      };
      var sparksd = new sparksService(config);
      sparksd.syncPercentage = sinon.stub();
      sparksd._resetCaches = sinon.stub();
      sparksd.node.stopping = true;
      var node = {
        client: {
          getBlock: sinon.stub().callsArgWith(1, null, {
            result: {
              height: 10
            }
          })
        }
      };
      sparksd.on('tip', function() {
        sparksd.syncPercentage.callCount.should.equal(0);
        done();
      });
      sparksd._updateTip(node, message);
    });
  });

  describe('#_getAddressesFromTransaction', function() {
    it('will get results using sparkscore.Transaction', function() {
      var sparksd = new sparksService(baseConfig);
      var wif = 'XGLgPK8gbmzU7jcbw34Pj55AXV7SmG6carKuiwtu4WtvTjyTbpwX';
      var privkey = sparkscore.PrivateKey.fromWIF(wif);
      var inputAddress = privkey.toAddress(sparkscore.Networks.testnet);
      var outputAddress = sparkscore.Address('8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi');
      var tx = sparkscore.Transaction();
      tx.from({
        txid: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
        outputIndex: 0,
        script: sparkscore.Script(inputAddress),
        address: inputAddress.toString(),
        satoshis: 5000000000
      });
      tx.to(outputAddress, 5000000000);
      tx.sign(privkey);
      var addresses = sparksd._getAddressesFromTransaction(tx);
      addresses.length.should.equal(2);
      addresses[0].should.equal(inputAddress.toString());
      addresses[1].should.equal(outputAddress.toString());
    });
    it('will handle non-standard script types', function() {
      var sparksd = new sparksService(baseConfig);
      var tx = sparkscore.Transaction();
      tx.addInput(sparkscore.Transaction.Input({
        prevTxId: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
        script: sparkscore.Script('OP_TRUE'),
        outputIndex: 1,
        output: {
          script: sparkscore.Script('OP_TRUE'),
          satoshis: 5000000000
        }
      }));
      tx.addOutput(sparkscore.Transaction.Output({
        script: sparkscore.Script('OP_TRUE'),
        satoshis: 5000000000
      }));
      var addresses = sparksd._getAddressesFromTransaction(tx);
      addresses.length.should.equal(0);
    });
    it('will handle unparsable script types or missing input script', function() {
      var sparksd = new sparksService(baseConfig);
      var tx = sparkscore.Transaction();
      tx.addOutput(sparkscore.Transaction.Output({
        script: new Buffer('4c', 'hex'),
        satoshis: 5000000000
      }));
      var addresses = sparksd._getAddressesFromTransaction(tx);
      addresses.length.should.equal(0);
    });
    it('will return unique values', function() {
      var sparksd = new sparksService(baseConfig);
      var tx = sparkscore.Transaction();
      var address = sparkscore.Address('8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi');
      tx.addOutput(sparkscore.Transaction.Output({
        script: sparkscore.Script(address),
        satoshis: 5000000000
      }));
      tx.addOutput(sparkscore.Transaction.Output({
        script: sparkscore.Script(address),
        satoshis: 5000000000
      }));
      var addresses = sparksd._getAddressesFromTransaction(tx);
      addresses.length.should.equal(1);
    });
  });

  describe('#_notifyAddressTxidSubscribers', function() {
    it('will emit event if matching addresses', function(done) {
      var sparksd = new sparksService(baseConfig);
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd._getAddressesFromTransaction = sinon.stub().returns([address]);
      var emitter = new EventEmitter();
      sparksd.subscriptions.address[address] = [emitter];
      var txid = '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0';
      var transaction = {};
      emitter.on('sparksd/addresstxid', function(data) {
        data.address.should.equal(address);
        data.txid.should.equal(txid);
        done();
      });
      sinon.spy(emitter, 'emit');
      sparksd._notifyAddressTxidSubscribers(txid, transaction);
      emitter.emit.callCount.should.equal(1);
    });
    it('will NOT emit event without matching addresses', function() {
      var sparksd = new sparksService(baseConfig);
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd._getAddressesFromTransaction = sinon.stub().returns([address]);
      var emitter = new EventEmitter();
      var txid = '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0';
      var transaction = {};
      emitter.emit = sinon.stub();
      sparksd._notifyAddressTxidSubscribers(txid, transaction);
      emitter.emit.callCount.should.equal(0);
    });
  });

  describe('#_zmqTransactionHandler', function() {
    it('will emit to subscribers', function(done) {
      var sparksd = new sparksService(baseConfig);
      var expectedBuffer = new Buffer(txhex, 'hex');
      var emitter = new EventEmitter();
      sparksd.subscriptions.rawtransaction.push(emitter);
      emitter.on('sparksd/rawtransaction', function(hex) {
        hex.should.be.a('string');
        hex.should.equal(expectedBuffer.toString('hex'));
        done();
      });
      var node = {};
      sparksd._zmqTransactionHandler(node, expectedBuffer);
    });
    it('will NOT emit to subscribers more than once for the same tx', function(done) {
      var sparksd = new sparksService(baseConfig);
      var expectedBuffer = new Buffer(txhex, 'hex');
      var emitter = new EventEmitter();
      sparksd.subscriptions.rawtransaction.push(emitter);
      emitter.on('sparksd/rawtransaction', function() {
        done();
      });
      var node = {};
      sparksd._zmqTransactionHandler(node, expectedBuffer);
      sparksd._zmqTransactionHandler(node, expectedBuffer);
    });
    it('will emit "tx" event', function(done) {
      var sparksd = new sparksService(baseConfig);
      var expectedBuffer = new Buffer(txhex, 'hex');
      sparksd.on('tx', function(buffer) {
        buffer.should.be.instanceof(Buffer);
        buffer.toString('hex').should.equal(expectedBuffer.toString('hex'));
        done();
      });
      var node = {};
      sparksd._zmqTransactionHandler(node, expectedBuffer);
    });
    it('will NOT emit "tx" event more than once for the same tx', function(done) {
      var sparksd = new sparksService(baseConfig);
      var expectedBuffer = new Buffer(txhex, 'hex');
      sparksd.on('tx', function() {
        done();
      });
      var node = {};
      sparksd._zmqTransactionHandler(node, expectedBuffer);
      sparksd._zmqTransactionHandler(node, expectedBuffer);
    });
  });

  // TODO: transaction lock test coverage
  describe('#_zmqTransactionLockHandler', function() {
    it('will emit to subscribers', function(done) {
      var sparksd = new sparksService(baseConfig);
      var expectedBuffer = new Buffer(txhex, 'hex');
      var emitter = new EventEmitter();
      sparksd.subscriptions.transactionlock.push(emitter);
      emitter.on('sparksd/transactionlock', function(hex) {
        hex.should.be.a('string');
        hex.should.equal(expectedBuffer.toString('hex'));
        done();
      });
      var node = {};
      sparksd._zmqTransactionLockHandler(node, expectedBuffer);
    });
    it('will NOT emit to subscribers more than once for the same tx', function(done) {
      var sparksd = new sparksService(baseConfig);
      var expectedBuffer = new Buffer(txhex, 'hex');
      var emitter = new EventEmitter();
      sparksd.subscriptions.transactionlock.push(emitter);
      emitter.on('sparksd/transactionlock', function() {
        done();
      });
      var node = {};
      sparksd._zmqTransactionLockHandler(node, expectedBuffer);
      sparksd._zmqTransactionLockHandler(node, expectedBuffer);
    });
    it('will emit "tx" event', function(done) {
      var sparksd = new sparksService(baseConfig);
      var expectedBuffer = new Buffer(txhex, 'hex');
      sparksd.on('txlock', function(buffer) {
        buffer.should.be.instanceof(Buffer);
        buffer.toString('hex').should.equal(expectedBuffer.toString('hex'));
        done();
      });
      var node = {};
      sparksd._zmqTransactionLockHandler(node, expectedBuffer);
    });
    it('will NOT emit "tx" event more than once for the same tx', function(done) {
      var sparksd = new sparksService(baseConfig);
      var expectedBuffer = new Buffer(txhex, 'hex');
      sparksd.on('txlock', function() {
        done();
      });
      var node = {};
      sparksd._zmqTransactionLockHandler(node, expectedBuffer);
      sparksd._zmqTransactionLockHandler(node, expectedBuffer);
    });
  });

  describe('#_checkSyncedAndSubscribeZmqEvents', function() {
    var sandbox = sinon.sandbox.create();
    before(function() {
      sandbox.stub(log, 'error');
    });
    after(function() {
      sandbox.restore();
    });
    it('log errors, update tip and subscribe to zmq events', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._updateTip = sinon.stub();
      sparksd._subscribeZmqEvents = sinon.stub();
      var blockEvents = 0;
      sparksd.on('block', function() {
        blockEvents++;
      });
      var getBestBlockHash = sinon.stub().callsArgWith(0, null, {
        result: '00000000000000001bb82a7f5973618cfd3185ba1ded04dd852a653f92a27c45'
      });
      getBestBlockHash.onCall(0).callsArgWith(0, {code: -1 , message: 'Test error'});
      var progress = 0.90;
      function getProgress() {
        progress = progress + 0.01;
        return progress;
      }
      var info = {};
      Object.defineProperty(info, 'result', {
        get: function() {
          return {
            verificationprogress: getProgress()
          };
        }
      });
      var getBlockchainInfo = sinon.stub().callsArgWith(0, null, info);
      getBlockchainInfo.onCall(0).callsArgWith(0, {code: -1, message: 'Test error'});
      var node = {
        _reindex: true,
        _reindexWait: 1,
        _tipUpdateInterval: 1,
        client: {
          getBestBlockHash: getBestBlockHash,
          getBlockchainInfo: getBlockchainInfo
        }
      };
      sparksd._checkSyncedAndSubscribeZmqEvents(node);
      setTimeout(function() {
        log.error.callCount.should.equal(2);
        blockEvents.should.equal(11);
        sparksd._updateTip.callCount.should.equal(11);
        sparksd._subscribeZmqEvents.callCount.should.equal(1);
        done();
      }, 200);
    });
    it('it will clear interval if node is stopping', function(done) {
      var config = {
        node: {
          network: sparkscore.Networks.testnet
        },
        spawn: {
          datadir: 'testdir',
          exec: 'testpath'
        }
      };
      var sparksd = new sparksService(config);
      var getBestBlockHash = sinon.stub().callsArgWith(0, {code: -1, message: 'error'});
      var node = {
        _tipUpdateInterval: 1,
        client: {
          getBestBlockHash: getBestBlockHash
        }
      };
      sparksd._checkSyncedAndSubscribeZmqEvents(node);
      setTimeout(function() {
        sparksd.node.stopping = true;
        var count = getBestBlockHash.callCount;
        setTimeout(function() {
          getBestBlockHash.callCount.should.equal(count);
          done();
        }, 100);
      }, 100);
    });
    it('will not set interval if synced is true', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._updateTip = sinon.stub();
      sparksd._subscribeZmqEvents = sinon.stub();
      var getBestBlockHash = sinon.stub().callsArgWith(0, null, {
        result: '00000000000000001bb82a7f5973618cfd3185ba1ded04dd852a653f92a27c45'
      });
      var info = {
        result: {
          verificationprogress: 1.00
        }
      };
      var getBlockchainInfo = sinon.stub().callsArgWith(0, null, info);
      var node = {
        _tipUpdateInterval: 1,
        client: {
          getBestBlockHash: getBestBlockHash,
          getBlockchainInfo: getBlockchainInfo
        }
      };
      sparksd._checkSyncedAndSubscribeZmqEvents(node);
      setTimeout(function() {
        getBestBlockHash.callCount.should.equal(1);
        getBlockchainInfo.callCount.should.equal(1);
        done();
      }, 200);
    });
  });

  describe('#_subscribeZmqEvents', function() {
    it('will call subscribe on zmq socket', function() {
      var sparksd = new sparksService(baseConfig);
      var node = {
        zmqSubSocket: {
          subscribe: sinon.stub(),
          on: sinon.stub()
        }
      };
      sparksd._subscribeZmqEvents(node);
      node.zmqSubSocket.subscribe.callCount.should.equal(3);
      node.zmqSubSocket.subscribe.args[0][0].should.equal('hashblock');
      node.zmqSubSocket.subscribe.args[1][0].should.equal('rawtx');
      node.zmqSubSocket.subscribe.args[2][0].should.equal('rawtxlock');
    });
    it('will call relevant handler for rawtx topics', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._zmqTransactionHandler = sinon.stub();
      var node = {
        zmqSubSocket: new EventEmitter()
      };
      node.zmqSubSocket.subscribe = sinon.stub();
      sparksd._subscribeZmqEvents(node);
      node.zmqSubSocket.on('message', function() {
        sparksd._zmqTransactionHandler.callCount.should.equal(1);
        done();
      });
      var topic = new Buffer('rawtx', 'utf8');
      var message = new Buffer('abcdef', 'hex');
      node.zmqSubSocket.emit('message', topic, message);
    });
    it('will call relevant handler for hashblock topics', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._zmqBlockHandler = sinon.stub();
      var node = {
        zmqSubSocket: new EventEmitter()
      };
      node.zmqSubSocket.subscribe = sinon.stub();
      sparksd._subscribeZmqEvents(node);
      node.zmqSubSocket.on('message', function() {
        sparksd._zmqBlockHandler.callCount.should.equal(1);
        done();
      });
      var topic = new Buffer('hashblock', 'utf8');
      var message = new Buffer('abcdef', 'hex');
      node.zmqSubSocket.emit('message', topic, message);
    });
    it('will ignore unknown topic types', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._zmqBlockHandler = sinon.stub();
      sparksd._zmqTransactionHandler = sinon.stub();
      var node = {
        zmqSubSocket: new EventEmitter()
      };
      node.zmqSubSocket.subscribe = sinon.stub();
      sparksd._subscribeZmqEvents(node);
      node.zmqSubSocket.on('message', function() {
        sparksd._zmqBlockHandler.callCount.should.equal(0);
        sparksd._zmqTransactionHandler.callCount.should.equal(0);
        done();
      });
      var topic = new Buffer('unknown', 'utf8');
      var message = new Buffer('abcdef', 'hex');
      node.zmqSubSocket.emit('message', topic, message);
    });
  });

  describe('#_initZmqSubSocket', function() {
    it('will setup zmq socket', function() {
      var socket = new EventEmitter();
      socket.monitor = sinon.stub();
      socket.connect = sinon.stub();
      var socketFunc = function() {
        return socket;
      };
      var sparksService = proxyquire('../../lib/services/sparksd', {
        zmq: {
          socket: socketFunc
        }
      });
      var sparksd = new sparksService(baseConfig);
      var node = {};
      sparksd._initZmqSubSocket(node, 'url');
      node.zmqSubSocket.should.equal(socket);
      socket.connect.callCount.should.equal(1);
      socket.connect.args[0][0].should.equal('url');
      socket.monitor.callCount.should.equal(1);
      socket.monitor.args[0][0].should.equal(500);
      socket.monitor.args[0][1].should.equal(0);
    });
  });

  describe('#_checkReindex', function() {
    var sandbox = sinon.sandbox.create();
    before(function() {
      sandbox.stub(log, 'info');
    });
    after(function() {
      sandbox.restore();
    });
    it('give error from client getblockchaininfo', function(done) {
      var sparksd = new sparksService(baseConfig);
      var node = {
        _reindex: true,
        _reindexWait: 1,
        client: {
          getBlockchainInfo: sinon.stub().callsArgWith(0, {code: -1 , message: 'Test error'})
        }
      };
      sparksd._checkReindex(node, function(err) {
        should.exist(err);
        err.should.be.instanceof(errors.RPCError);
        done();
      });
    });
    it('will wait until sync is 100 percent', function(done) {
      var sparksd = new sparksService(baseConfig);
      var percent = 0.89;
      var node = {
        _reindex: true,
        _reindexWait: 1,
        client: {
          getBlockchainInfo: function(callback) {
            percent += 0.01;
            callback(null, {
              result: {
                verificationprogress: percent
              }
            });
          }
        }
      };
      sparksd._checkReindex(node, function() {
        node._reindex.should.equal(false);
        log.info.callCount.should.equal(11);
        done();
      });
    });
    it('will call callback if reindex is not enabled', function(done) {
      var sparksd = new sparksService(baseConfig);
      var node = {
        _reindex: false
      };
      sparksd._checkReindex(node, function() {
        node._reindex.should.equal(false);
        done();
      });
    });
  });

  describe('#_loadTipFromNode', function() {
    var sandbox = sinon.sandbox.create();
    beforeEach(function() {
      sandbox.stub(log, 'warn');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('will give rpc from client getbestblockhash', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBestBlockHash = sinon.stub().callsArgWith(0, {code: -1, message: 'Test error'});
      var node = {
        client: {
          getBestBlockHash: getBestBlockHash
        }
      };
      sparksd._loadTipFromNode(node, function(err) {
        err.should.be.instanceof(Error);
        log.warn.callCount.should.equal(0);
        done();
      });
    });
    it('will give rpc from client getblock', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBestBlockHash = sinon.stub().callsArgWith(0, null, {
        result: '00000000000000001bb82a7f5973618cfd3185ba1ded04dd852a653f92a27c45'
      });
      var getBlock = sinon.stub().callsArgWith(1, new Error('Test error'));
      var node = {
        client: {
          getBestBlockHash: getBestBlockHash,
          getBlock: getBlock
        }
      };
      sparksd._loadTipFromNode(node, function(err) {
        getBlock.args[0][0].should.equal('00000000000000001bb82a7f5973618cfd3185ba1ded04dd852a653f92a27c45');
        err.should.be.instanceof(Error);
        log.warn.callCount.should.equal(0);
        done();
      });
    });
    it('will log when error is RPC_IN_WARMUP', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBestBlockHash = sinon.stub().callsArgWith(0, {code: -28, message: 'Verifying blocks...'});
      var node = {
        client: {
          getBestBlockHash: getBestBlockHash
        }
      };
      sparksd._loadTipFromNode(node, function(err) {
        err.should.be.instanceof(Error);
        log.warn.callCount.should.equal(1);
        done();
      });
    });
    it('will set height and emit tip', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBestBlockHash = sinon.stub().callsArgWith(0, null, {
        result: '00000000000000001bb82a7f5973618cfd3185ba1ded04dd852a653f92a27c45'
      });
      var getBlock = sinon.stub().callsArgWith(1, null, {
        result: {
          height: 100
        }
      });
      var node = {
        client: {
          getBestBlockHash: getBestBlockHash,
          getBlock: getBlock
        }
      };
      sparksd.on('tip', function(height) {
        height.should.equal(100);
        sparksd.height.should.equal(100);
        done();
      });
      sparksd._loadTipFromNode(node, function(err) {
        if (err) {
          return done(err);
        }
      });
    });
  });

  describe('#_stopSpawnedProcess', function() {
    var sandbox = sinon.sandbox.create();
    beforeEach(function() {
      sandbox.stub(log, 'warn');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('it will kill process and resume', function(done) {
      var readFile = sandbox.stub();
      readFile.onCall(0).callsArgWith(2, null, '4321');
      var error = new Error('Test error');
      error.code = 'ENOENT';
      readFile.onCall(1).callsArgWith(2, error);
      var TestsparksService = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFile: readFile
        }
      });
      var sparksd = new TestsparksService(baseConfig);
      sparksd.spawnStopTime = 1;
      sparksd._process = {};
      sparksd._process.kill = sinon.stub();
      sparksd._stopSpawnedsparks(function(err) {
        if (err) {
          return done(err);
        }
        sparksd._process.kill.callCount.should.equal(1);
        log.warn.callCount.should.equal(1);
        done();
      });
    });
    it('it will attempt to kill process and resume', function(done) {
      var readFile = sandbox.stub();
      readFile.onCall(0).callsArgWith(2, null, '4321');
      var error = new Error('Test error');
      error.code = 'ENOENT';
      readFile.onCall(1).callsArgWith(2, error);
      var TestsparksService = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFile: readFile
        }
      });
      var sparksd = new TestsparksService(baseConfig);
      sparksd.spawnStopTime = 1;
      sparksd._process = {};
      var error2 = new Error('Test error');
      error2.code = 'ESRCH';
      sparksd._process.kill = sinon.stub().throws(error2);
      sparksd._stopSpawnedsparks(function(err) {
        if (err) {
          return done(err);
        }
        sparksd._process.kill.callCount.should.equal(1);
        log.warn.callCount.should.equal(2);
        done();
      });
    });
    it('it will attempt to kill process with NaN', function(done) {
      var readFile = sandbox.stub();
      readFile.onCall(0).callsArgWith(2, null, '     ');
      var TestsparksService = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFile: readFile
        }
      });
      var sparksd = new TestsparksService(baseConfig);
      sparksd.spawnStopTime = 1;
      sparksd._process = {};
      sparksd._process.kill = sinon.stub();
      sparksd._stopSpawnedsparks(function(err) {
        if (err) {
          return done(err);
        }
        done();
      });
    });
    it('it will attempt to kill process without pid', function(done) {
      var readFile = sandbox.stub();
      readFile.onCall(0).callsArgWith(2, null, '');
      var TestsparksService = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFile: readFile
        }
      });
      var sparksd = new TestsparksService(baseConfig);
      sparksd.spawnStopTime = 1;
      sparksd._process = {};
      sparksd._process.kill = sinon.stub();
      sparksd._stopSpawnedsparks(function(err) {
        if (err) {
          return done(err);
        }
        done();
      });
    });
  });

  describe('#_spawnChildProcess', function() {
    var sandbox = sinon.sandbox.create();
    beforeEach(function() {
      sandbox.stub(log, 'info');
      sandbox.stub(log, 'warn');
      sandbox.stub(log, 'error');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('will give error from spawn config', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._loadSpawnConfiguration = sinon.stub();
      sparksd._loadSpawnConfiguration = sinon.stub().throws(new Error('test'));
      sparksd._spawnChildProcess(function(err) {
        err.should.be.instanceof(Error);
        err.message.should.equal('test');
        done();
      });
    });
    it('will give error from stopSpawnedsparks', function() {
      var sparksd = new sparksService(baseConfig);
      sparksd._loadSpawnConfiguration = sinon.stub();
      sparksd._stopSpawnedsparks = sinon.stub().callsArgWith(0, new Error('test'));
      sparksd._spawnChildProcess(function(err) {
        err.should.be.instanceOf(Error);
        err.message.should.equal('test');
      });
    });
    it('will exit spawn if shutdown', function() {
      var config = {
        node: {
          network: sparkscore.Networks.testnet
        },
        spawn: {
          datadir: 'testdir',
          exec: 'testpath'
        }
      };
      var process = new EventEmitter();
      var spawn = sinon.stub().returns(process);
      var TestsparksService = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFileSync: readFileSync
        },
        child_process: {
          spawn: spawn
        }
      });
      var sparksd = new TestsparksService(config);
      sparksd.spawn = {};
      sparksd._loadSpawnConfiguration = sinon.stub();
      sparksd._stopSpawnedsparks = sinon.stub().callsArgWith(0, null);
      sparksd.node.stopping = true;
      sparksd._spawnChildProcess(function(err) {
        err.should.be.instanceOf(Error);
        err.message.should.match(/Stopping while trying to spawn/);
      });
    });
    it('will include network with spawn command and init zmq/rpc on node', function(done) {
      var process = new EventEmitter();
      var spawn = sinon.stub().returns(process);
      var TestsparksService = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFileSync: readFileSync
        },
        child_process: {
          spawn: spawn
        }
      });
      var sparksd = new TestsparksService(baseConfig);

      sparksd._loadSpawnConfiguration = sinon.stub();
      sparksd.spawn = {};
      sparksd.spawn.exec = 'testexec';
      sparksd.spawn.configPath = 'testdir/sparks.conf';
      sparksd.spawn.datadir = 'testdir';
      sparksd.spawn.config = {};
      sparksd.spawn.config.rpcport = 20001;
      sparksd.spawn.config.rpcuser = 'sparks';
      sparksd.spawn.config.rpcpassword = 'password';
      sparksd.spawn.config.zmqpubrawtx = 'tcp://127.0.0.1:30001';
      sparksd.spawn.config.zmqpubrawtxlock = 'tcp://127.0.0.1:30001';

      sparksd._loadTipFromNode = sinon.stub().callsArgWith(1, null);
      sparksd._initZmqSubSocket = sinon.stub();
      sparksd._checkSyncedAndSubscribeZmqEvents = sinon.stub();
      sparksd._checkReindex = sinon.stub().callsArgWith(1, null);
      sparksd._spawnChildProcess(function(err, node) {
        should.not.exist(err);
        spawn.callCount.should.equal(1);
        spawn.args[0][0].should.equal('testexec');
        spawn.args[0][1].should.deep.equal([
          '--conf=testdir/sparks.conf',
          '--datadir=testdir',
          '--testnet'
        ]);
        spawn.args[0][2].should.deep.equal({
          stdio: 'inherit'
        });
        sparksd._loadTipFromNode.callCount.should.equal(1);
        sparksd._initZmqSubSocket.callCount.should.equal(1);
        should.exist(sparksd._initZmqSubSocket.args[0][0].client);
        sparksd._initZmqSubSocket.args[0][1].should.equal('tcp://127.0.0.1:30001');
        sparksd._checkSyncedAndSubscribeZmqEvents.callCount.should.equal(1);
        should.exist(sparksd._checkSyncedAndSubscribeZmqEvents.args[0][0].client);
        should.exist(node);
        should.exist(node.client);
        done();
      });
    });
    it('will respawn sparksd spawned process', function(done) {
      var process = new EventEmitter();
      var spawn = sinon.stub().returns(process);
      var TestsparksService = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFileSync: readFileSync
        },
        child_process: {
          spawn: spawn
        }
      });
      var sparksd = new TestsparksService(baseConfig);
      sparksd._loadSpawnConfiguration = sinon.stub();
      sparksd.spawn = {};
      sparksd.spawn.exec = 'sparksd';
      sparksd.spawn.datadir = '/tmp/sparks';
      sparksd.spawn.configPath = '/tmp/sparks/sparks.conf';
      sparksd.spawn.config = {};
      sparksd.spawnRestartTime = 1;
      sparksd._loadTipFromNode = sinon.stub().callsArg(1);
      sparksd._initZmqSubSocket = sinon.stub();
      sparksd._checkReindex = sinon.stub().callsArg(1);
      sparksd._checkSyncedAndSubscribeZmqEvents = sinon.stub();
      sparksd._stopSpawnedsparks = sinon.stub().callsArg(0);
      sinon.spy(sparksd, '_spawnChildProcess');
      sparksd._spawnChildProcess(function(err) {
        if (err) {
          return done(err);
        }
        process.once('exit', function() {
          setTimeout(function() {
            sparksd._spawnChildProcess.callCount.should.equal(2);
            done();
          }, 5);
        });
        process.emit('exit', 1);
      });
    });
    it('will emit error during respawn', function(done) {
      var process = new EventEmitter();
      var spawn = sinon.stub().returns(process);
      var TestsparksService = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFileSync: readFileSync
        },
        child_process: {
          spawn: spawn
        }
      });
      var sparksd = new TestsparksService(baseConfig);
      sparksd._loadSpawnConfiguration = sinon.stub();
      sparksd.spawn = {};
      sparksd.spawn.exec = 'sparksd';
      sparksd.spawn.datadir = '/tmp/sparks';
      sparksd.spawn.configPath = '/tmp/sparks/sparks.conf';
      sparksd.spawn.config = {};
      sparksd.spawnRestartTime = 1;
      sparksd._loadTipFromNode = sinon.stub().callsArg(1);
      sparksd._initZmqSubSocket = sinon.stub();
      sparksd._checkReindex = sinon.stub().callsArg(1);
      sparksd._checkSyncedAndSubscribeZmqEvents = sinon.stub();
      sparksd._stopSpawnedsparks = sinon.stub().callsArg(0);
      sinon.spy(sparksd, '_spawnChildProcess');
      sparksd._spawnChildProcess(function(err) {
        if (err) {
          return done(err);
        }
        sparksd._spawnChildProcess = sinon.stub().callsArgWith(0, new Error('test'));
        sparksd.on('error', function(err) {
          err.should.be.instanceOf(Error);
          err.message.should.equal('test');
          done();
        });
        process.emit('exit', 1);
      });
    });
    it('will NOT respawn sparksd spawned process if shutting down', function(done) {
      var process = new EventEmitter();
      var spawn = sinon.stub().returns(process);
      var TestsparksService = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFileSync: readFileSync
        },
        child_process: {
          spawn: spawn
        }
      });
      var config = {
        node: {
          network: sparkscore.Networks.testnet
        },
        spawn: {
          datadir: 'testdir',
          exec: 'testpath'
        }
      };
      var sparksd = new TestsparksService(config);
      sparksd._loadSpawnConfiguration = sinon.stub();
      sparksd.spawn = {};
      sparksd.spawn.exec = 'sparksd';
      sparksd.spawn.datadir = '/tmp/sparks';
      sparksd.spawn.configPath = '/tmp/sparks/sparks.conf';
      sparksd.spawn.config = {};
      sparksd.spawnRestartTime = 1;
      sparksd._loadTipFromNode = sinon.stub().callsArg(1);
      sparksd._initZmqSubSocket = sinon.stub();
      sparksd._checkReindex = sinon.stub().callsArg(1);
      sparksd._checkSyncedAndSubscribeZmqEvents = sinon.stub();
      sparksd._stopSpawnedsparks = sinon.stub().callsArg(0);
      sinon.spy(sparksd, '_spawnChildProcess');
      sparksd._spawnChildProcess(function(err) {
        if (err) {
          return done(err);
        }
        sparksd.node.stopping = true;
        process.once('exit', function() {
          setTimeout(function() {
            sparksd._spawnChildProcess.callCount.should.equal(1);
            done();
          }, 5);
        });
        process.emit('exit', 1);
      });
    });
    it('will give error after 60 retries', function(done) {
      var process = new EventEmitter();
      var spawn = sinon.stub().returns(process);
      var TestsparksService = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFileSync: readFileSync
        },
        child_process: {
          spawn: spawn
        }
      });
      var sparksd = new TestsparksService(baseConfig);
      sparksd.startRetryInterval = 1;
      sparksd._loadSpawnConfiguration = sinon.stub();
      sparksd.spawn = {};
      sparksd.spawn.exec = 'testexec';
      sparksd.spawn.configPath = 'testdir/sparks.conf';
      sparksd.spawn.datadir = 'testdir';
      sparksd.spawn.config = {};
      sparksd.spawn.config.rpcport = 20001;
      sparksd.spawn.config.rpcuser = 'sparks';
      sparksd.spawn.config.rpcpassword = 'password';
      sparksd.spawn.config.zmqpubrawtx = 'tcp://127.0.0.1:30001';
      sparksd.spawn.config.zmqpubrawtxlock = 'tcp://127.0.0.1:30001';
      sparksd._loadTipFromNode = sinon.stub().callsArgWith(1, new Error('test'));
      sparksd._spawnChildProcess(function(err) {
        sparksd._loadTipFromNode.callCount.should.equal(60);
        err.should.be.instanceof(Error);
        done();
      });
    });
    it('will give error from check reindex', function(done) {
      var process = new EventEmitter();
      var spawn = sinon.stub().returns(process);
      var TestsparksService = proxyquire('../../lib/services/sparksd', {
        fs: {
          readFileSync: readFileSync
        },
        child_process: {
          spawn: spawn
        }
      });
      var sparksd = new TestsparksService(baseConfig);

      sparksd._loadSpawnConfiguration = sinon.stub();
      sparksd.spawn = {};
      sparksd.spawn.exec = 'testexec';
      sparksd.spawn.configPath = 'testdir/sparks.conf';
      sparksd.spawn.datadir = 'testdir';
      sparksd.spawn.config = {};
      sparksd.spawn.config.rpcport = 20001;
      sparksd.spawn.config.rpcuser = 'sparks';
      sparksd.spawn.config.rpcpassword = 'password';
      sparksd.spawn.config.zmqpubrawtx = 'tcp://127.0.0.1:30001';
      sparksd.spawn.config.zmqpubrawtxlock = 'tcp://127.0.0.1:30001';

      sparksd._loadTipFromNode = sinon.stub().callsArgWith(1, null);
      sparksd._initZmqSubSocket = sinon.stub();
      sparksd._checkSyncedAndSubscribeZmqEvents = sinon.stub();
      sparksd._checkReindex = sinon.stub().callsArgWith(1, new Error('test'));

      sparksd._spawnChildProcess(function(err) {
        err.should.be.instanceof(Error);
        done();
      });
    });
  });

  describe('#_connectProcess', function() {
    it('will give error if connecting while shutting down', function(done) {
      var config = {
        node: {
          network: sparkscore.Networks.testnet
        },
        spawn: {
          datadir: 'testdir',
          exec: 'testpath'
        }
      };
      var sparksd = new sparksService(config);
      sparksd.node.stopping = true;
      sparksd.startRetryInterval = 100;
      sparksd._loadTipFromNode = sinon.stub();
      sparksd._connectProcess({}, function(err) {
        err.should.be.instanceof(Error);
        err.message.should.match(/Stopping while trying to connect/);
        sparksd._loadTipFromNode.callCount.should.equal(0);
        done();
      });
    });
    it('will give error from loadTipFromNode after 60 retries', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._loadTipFromNode = sinon.stub().callsArgWith(1, new Error('test'));
      sparksd.startRetryInterval = 1;
      var config = {};
      sparksd._connectProcess(config, function(err) {
        err.should.be.instanceof(Error);
        sparksd._loadTipFromNode.callCount.should.equal(60);
        done();
      });
    });
    it('will init zmq/rpc on node', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._initZmqSubSocket = sinon.stub();
      sparksd._subscribeZmqEvents = sinon.stub();
      sparksd._loadTipFromNode = sinon.stub().callsArgWith(1, null);
      var config = {};
      sparksd._connectProcess(config, function(err, node) {
        should.not.exist(err);
        sparksd._loadTipFromNode.callCount.should.equal(1);
        sparksd._initZmqSubSocket.callCount.should.equal(1);
        sparksd._loadTipFromNode.callCount.should.equal(1);
        should.exist(node);
        should.exist(node.client);
        done();
      });
    });
  });

  describe('#start', function() {
    var sandbox = sinon.sandbox.create();
    beforeEach(function() {
      sandbox.stub(log, 'info');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('will give error if "spawn" and "connect" are both not configured', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.options = {};
      sparksd.start(function(err) {
        err.should.be.instanceof(Error);
        err.message.should.match(/sparks configuration options/);
      });
      done();
    });
    it('will give error from spawnChildProcess', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._spawnChildProcess = sinon.stub().callsArgWith(0, new Error('test'));
      sparksd.options = {
        spawn: {}
      };
      sparksd.start(function(err) {
        err.should.be.instanceof(Error);
        err.message.should.equal('test');
        done();
      });
    });
    it('will give error from connectProcess', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._connectProcess = sinon.stub().callsArgWith(1, new Error('test'));
      sparksd.options = {
        connect: [
          {}
        ]
      };
      sparksd.start(function(err) {
        sparksd._connectProcess.callCount.should.equal(1);
        err.should.be.instanceof(Error);
        err.message.should.equal('test');
        done();
      });
    });
    it('will push node from spawnChildProcess', function(done) {
      var sparksd = new sparksService(baseConfig);
      var node = {};
      sparksd._initChain = sinon.stub().callsArg(0);
      sparksd._spawnChildProcess = sinon.stub().callsArgWith(0, null, node);
      sparksd.options = {
        spawn: {}
      };
      sparksd.start(function(err) {
        should.not.exist(err);
        sparksd.nodes.length.should.equal(1);
        done();
      });
    });
    it('will push node from connectProcess', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._initChain = sinon.stub().callsArg(0);
      var nodes = [{}];
      sparksd._connectProcess = sinon.stub().callsArgWith(1, null, nodes);
      sparksd.options = {
        connect: [
          {}
        ]
      };
      sparksd.start(function(err) {
        should.not.exist(err);
        sparksd._connectProcess.callCount.should.equal(1);
        sparksd.nodes.length.should.equal(1);
        done();
      });
    });
  });

  describe('#isSynced', function() {
    it('will give error from syncPercentage', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.syncPercentage = sinon.stub().callsArgWith(0, new Error('test'));
      sparksd.isSynced(function(err) {
        should.exist(err);
        err.message.should.equal('test');
        done();
      });
    });
    it('will give "true" if percentage is 100.00', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.syncPercentage = sinon.stub().callsArgWith(0, null, 100.00);
      sparksd.isSynced(function(err, synced) {
        if (err) {
          return done(err);
        }
        synced.should.equal(true);
        done();
      });
    });
    it('will give "true" if percentage is 99.98', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.syncPercentage = sinon.stub().callsArgWith(0, null, 99.98);
      sparksd.isSynced(function(err, synced) {
        if (err) {
          return done(err);
        }
        synced.should.equal(true);
        done();
      });
    });
    it('will give "false" if percentage is 99.49', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.syncPercentage = sinon.stub().callsArgWith(0, null, 99.49);
      sparksd.isSynced(function(err, synced) {
        if (err) {
          return done(err);
        }
        synced.should.equal(false);
        done();
      });
    });
    it('will give "false" if percentage is 1', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.syncPercentage = sinon.stub().callsArgWith(0, null, 1);
      sparksd.isSynced(function(err, synced) {
        if (err) {
          return done(err);
        }
        synced.should.equal(false);
        done();
      });
    });
  });

  describe('#syncPercentage', function() {
    it('will give rpc error', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlockchainInfo = sinon.stub().callsArgWith(0, {message: 'error', code: -1});
      sparksd.nodes.push({
        client: {
          getBlockchainInfo: getBlockchainInfo
        }
      });
      sparksd.syncPercentage(function(err) {
        should.exist(err);
        err.should.be.an.instanceof(errors.RPCError);
        done();
      });
    });
    it('will call client getInfo and give result', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlockchainInfo = sinon.stub().callsArgWith(0, null, {
        result: {
          verificationprogress: '0.983821387'
        }
      });
      sparksd.nodes.push({
        client: {
          getBlockchainInfo: getBlockchainInfo
        }
      });
      sparksd.syncPercentage(function(err, percentage) {
        if (err) {
          return done(err);
        }
        percentage.should.equal(98.3821387);
        done();
      });
    });
  });

  describe('#_normalizeAddressArg', function() {
    it('will turn single address into array', function() {
      var sparksd = new sparksService(baseConfig);
      var args = sparksd._normalizeAddressArg('address');
      args.should.deep.equal(['address']);
    });
    it('will keep an array as an array', function() {
      var sparksd = new sparksService(baseConfig);
      var args = sparksd._normalizeAddressArg(['address', 'address']);
      args.should.deep.equal(['address', 'address']);
    });
  });

  describe('#getAddressBalance', function() {
    it('will give rpc error', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getAddressBalance: sinon.stub().callsArgWith(1, {code: -1, message: 'Test error'})
        }
      });
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      var options = {};
      sparksd.getAddressBalance(address, options, function(err) {
        err.should.be.instanceof(Error);
        done();
      });
    });
    it('will give balance', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getAddressBalance = sinon.stub().callsArgWith(1, null, {
        result: {
          received: 100000,
          balance: 10000
        }
      });
      sparksd.nodes.push({
        client: {
          getAddressBalance: getAddressBalance
        }
      });
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      var options = {};
      sparksd.getAddressBalance(address, options, function(err, data) {
        if (err) {
          return done(err);
        }
        data.balance.should.equal(10000);
        data.received.should.equal(100000);
        sparksd.getAddressBalance(address, options, function(err, data2) {
          if (err) {
            return done(err);
          }
          data2.balance.should.equal(10000);
          data2.received.should.equal(100000);
          getAddressBalance.callCount.should.equal(1);
          done();
        });
      });
    });
  });

  describe('#getAddressUnspentOutputs', function() {
    it('will give rpc error', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getAddressUtxos: sinon.stub().callsArgWith(1, {code: -1, message: 'Test error'})
        }
      });
      var options = {
        queryMempool: false
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressUnspentOutputs(address, options, function(err) {
        should.exist(err);
        err.should.be.instanceof(errors.RPCError);
        done();
      });
    });
    it('will give results from client getaddressutxos', function(done) {
      var sparksd = new sparksService(baseConfig);
      var expectedUtxos = [
        {
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          txid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          outputIndex: 1,
          script: '76a914f399b4b8894f1153b96fce29f05e6e116eb4c21788ac',
          satoshis: 7679241,
          height: 207111
        }
      ];
      sparksd.nodes.push({
        client: {
          getAddressUtxos: sinon.stub().callsArgWith(1, null, {
            result: expectedUtxos
          })
        }
      });
      var options = {
        queryMempool: false
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressUnspentOutputs(address, options, function(err, utxos) {
        if (err) {
          return done(err);
        }
        utxos.length.should.equal(1);
        utxos.should.deep.equal(expectedUtxos);
        done();
      });
    });
    it('will use cache', function(done) {
      var sparksd = new sparksService(baseConfig);
      var expectedUtxos = [
        {
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          txid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          outputIndex: 1,
          script: '76a914f399b4b8894f1153b96fce29f05e6e116eb4c21788ac',
          satoshis: 7679241,
          height: 207111
        }
      ];
      var getAddressUtxos = sinon.stub().callsArgWith(1, null, {
        result: expectedUtxos
      });
      sparksd.nodes.push({
        client: {
          getAddressUtxos: getAddressUtxos
        }
      });
      var options = {
        queryMempool: false
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressUnspentOutputs(address, options, function(err, utxos) {
        if (err) {
          return done(err);
        }
        utxos.length.should.equal(1);
        utxos.should.deep.equal(expectedUtxos);
        getAddressUtxos.callCount.should.equal(1);
        sparksd.getAddressUnspentOutputs(address, options, function(err, utxos) {
          if (err) {
            return done(err);
          }
          utxos.length.should.equal(1);
          utxos.should.deep.equal(expectedUtxos);
          getAddressUtxos.callCount.should.equal(1);
          done();
        });
      });
    });
    it('will update with mempool results', function(done) {
      var deltas = [
        {
          txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          satoshis: -7679241,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 0,
          timestamp: 1461342707725,
          prevtxid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          prevout: 1
        },
        {
          txid: 'f637384e9f81f18767ea50e00bce58fc9848b6588a1130529eebba22a410155f',
          satoshis: 100000,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 0,
          timestamp: 1461342833133
        },
        {
          txid: 'f71bccef3a8f5609c7f016154922adbfe0194a96fb17a798c24077c18d0a9345',
          satoshis: 400000,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 1,
          timestamp: 1461342954813
        }
      ];
      var sparksd = new sparksService(baseConfig);
      var confirmedUtxos = [
        {
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          txid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          outputIndex: 1,
          script: '76a914f399b4b8894f1153b96fce29f05e6e116eb4c21788ac',
          satoshis: 7679241,
          height: 207111
        }
      ];
      var expectedUtxos = [
        {
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          outputIndex: 1,
          satoshis: 400000,
          script: '76a914809dc14496f99b6deb722cf46d89d22f4beb8efd88ac',
          timestamp: 1461342954813,
          txid: 'f71bccef3a8f5609c7f016154922adbfe0194a96fb17a798c24077c18d0a9345'
        },
        {
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          outputIndex: 0,
          satoshis: 100000,
          script: '76a914809dc14496f99b6deb722cf46d89d22f4beb8efd88ac',
          timestamp: 1461342833133,
          txid: 'f637384e9f81f18767ea50e00bce58fc9848b6588a1130529eebba22a410155f'
        }
      ];
      sparksd.nodes.push({
        client: {
          getAddressUtxos: sinon.stub().callsArgWith(1, null, {
            result: confirmedUtxos
          }),
          getAddressMempool: sinon.stub().callsArgWith(1, null, {
            result: deltas
          })
        }
      });
      var options = {
        queryMempool: true
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressUnspentOutputs(address, options, function(err, utxos) {
        if (err) {
          return done(err);
        }
        utxos.length.should.equal(2);
        utxos.should.deep.equal(expectedUtxos);
        done();
      });
    });
    it('will update with mempool results with multiple outputs', function(done) {
      var deltas = [
        {
          txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          satoshis: -7679241,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 0,
          timestamp: 1461342707725,
          prevtxid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          prevout: 1
        },
        {
          txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          satoshis: -7679241,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 1,
          timestamp: 1461342707725,
          prevtxid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          prevout: 2
        }
      ];
      var sparksd = new sparksService(baseConfig);
      var confirmedUtxos = [
        {
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          txid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          outputIndex: 1,
          script: '76a914f399b4b8894f1153b96fce29f05e6e116eb4c21788ac',
          satoshis: 7679241,
          height: 207111
        },
        {
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          txid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          outputIndex: 2,
          script: '76a914f399b4b8894f1153b96fce29f05e6e116eb4c21788ac',
          satoshis: 7679241,
          height: 207111
        }
      ];
      sparksd.nodes.push({
        client: {
          getAddressUtxos: sinon.stub().callsArgWith(1, null, {
            result: confirmedUtxos
          }),
          getAddressMempool: sinon.stub().callsArgWith(1, null, {
            result: deltas
          })
        }
      });
      var options = {
        queryMempool: true
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressUnspentOutputs(address, options, function(err, utxos) {
        if (err) {
          return done(err);
        }
        utxos.length.should.equal(0);
        done();
      });
    });
    it('three confirmed utxos -> one utxo after mempool', function(done) {
      var deltas = [
        {
          txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          satoshis: -7679241,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 0,
          timestamp: 1461342707725,
          prevtxid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          prevout: 0
        },
        {
          txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          satoshis: -7679241,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 0,
          timestamp: 1461342707725,
          prevtxid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          prevout: 1
        },
        {
          txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          satoshis: -7679241,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 1,
          timestamp: 1461342707725,
          prevtxid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          prevout: 2
        },
        {
          txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          satoshis: 100000,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 1,
          script: '76a914809dc14496f99b6deb722cf46d89d22f4beb8efd88ac',
          timestamp: 1461342833133
        }
      ];
      var sparksd = new sparksService(baseConfig);
      var confirmedUtxos = [
        {
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          txid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          outputIndex: 0,
          script: '76a914f399b4b8894f1153b96fce29f05e6e116eb4c21788ac',
          satoshis: 7679241,
          height: 207111
        },
        {
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          txid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          outputIndex: 1,
          script: '76a914f399b4b8894f1153b96fce29f05e6e116eb4c21788ac',
          satoshis: 7679241,
          height: 207111
        },
        {
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          txid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          outputIndex: 2,
          script: '76a914f399b4b8894f1153b96fce29f05e6e116eb4c21788ac',
          satoshis: 7679241,
          height: 207111
        }
      ];
      sparksd.nodes.push({
        client: {
          getAddressUtxos: sinon.stub().callsArgWith(1, null, {
            result: confirmedUtxos
          }),
          getAddressMempool: sinon.stub().callsArgWith(1, null, {
            result: deltas
          })
        }
      });
      var options = {
        queryMempool: true
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressUnspentOutputs(address, options, function(err, utxos) {
        if (err) {
          return done(err);
        }
        utxos.length.should.equal(1);
        done();
      });
    });
    it('spending utxos in the mempool', function(done) {
      var deltas = [
        {
          txid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          satoshis: 7679241,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 0,
          timestamp: 1461342707724
        },
        {
          txid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          satoshis: 7679241,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 1,
          timestamp: 1461342707724
        },
        {
          txid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          satoshis: 7679241,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          timestamp: 1461342707724,
          index: 2,
        },
        {
          txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          satoshis: -7679241,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 0,
          timestamp: 1461342707725,
          prevtxid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          prevout: 0
        },
        {
          txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          satoshis: -7679241,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 0,
          timestamp: 1461342707725,
          prevtxid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          prevout: 1
        },
        {
          txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          satoshis: -7679241,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 1,
          timestamp: 1461342707725,
          prevtxid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          prevout: 2
        },
        {
          txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          satoshis: 100000,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 1,
          timestamp: 1461342833133
        }
      ];
      var sparksd = new sparksService(baseConfig);
      var confirmedUtxos = [];
      sparksd.nodes.push({
        client: {
          getAddressUtxos: sinon.stub().callsArgWith(1, null, {
            result: confirmedUtxos
          }),
          getAddressMempool: sinon.stub().callsArgWith(1, null, {
            result: deltas
          })
        }
      });
      var options = {
        queryMempool: true
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressUnspentOutputs(address, options, function(err, utxos) {
        if (err) {
          return done(err);
        }
        utxos.length.should.equal(1);
        utxos[0].address.should.equal(address);
        utxos[0].txid.should.equal('e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce');
        utxos[0].outputIndex.should.equal(1);
        utxos[0].script.should.equal('76a914809dc14496f99b6deb722cf46d89d22f4beb8efd88ac');
        utxos[0].timestamp.should.equal(1461342833133);
        done();
      });
    });
    it('will update with mempool results spending zero value output (likely never to happen)', function(done) {
      var deltas = [
        {
          txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          satoshis: 0,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 0,
          timestamp: 1461342707725,
          prevtxid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          prevout: 1
        }
      ];
      var sparksd = new sparksService(baseConfig);
      var confirmedUtxos = [
        {
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          txid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          outputIndex: 1,
          script: '76a914f399b4b8894f1153b96fce29f05e6e116eb4c21788ac',
          satoshis: 0,
          height: 207111
        }
      ];
      sparksd.nodes.push({
        client: {
          getAddressUtxos: sinon.stub().callsArgWith(1, null, {
            result: confirmedUtxos
          }),
          getAddressMempool: sinon.stub().callsArgWith(1, null, {
            result: deltas
          })
        }
      });
      var options = {
        queryMempool: true
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressUnspentOutputs(address, options, function(err, utxos) {
        if (err) {
          return done(err);
        }
        utxos.length.should.equal(0);
        done();
      });
    });
    it('will not filter results if mempool is not spending', function(done) {
      var deltas = [
        {
          txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          satoshis: 10000,
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          index: 0,
          timestamp: 1461342707725
        }
      ];
      var sparksd = new sparksService(baseConfig);
      var confirmedUtxos = [
        {
          address: 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs',
          txid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
          outputIndex: 1,
          script: '76a914f399b4b8894f1153b96fce29f05e6e116eb4c21788ac',
          satoshis: 0,
          height: 207111
        }
      ];
      sparksd.nodes.push({
        client: {
          getAddressUtxos: sinon.stub().callsArgWith(1, null, {
            result: confirmedUtxos
          }),
          getAddressMempool: sinon.stub().callsArgWith(1, null, {
            result: deltas
          })
        }
      });
      var options = {
        queryMempool: true
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressUnspentOutputs(address, options, function(err, utxos) {
        if (err) {
          return done(err);
        }
        utxos.length.should.equal(2);
        done();
      });
    });
    it('it will handle error from getAddressMempool', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getAddressMempool: sinon.stub().callsArgWith(1, {code: -1, message: 'test'})
        }
      });
      var options = {
        queryMempool: true
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressUnspentOutputs(address, options, function(err) {
        err.should.be.instanceOf(Error);
        done();
      });
    });
    it('should set query mempool if undefined', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getAddressMempool = sinon.stub().callsArgWith(1, {code: -1, message: 'test'});
      sparksd.nodes.push({
        client: {
          getAddressMempool: getAddressMempool
        }
      });
      var options = {};
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressUnspentOutputs(address, options, function(err) {
        getAddressMempool.callCount.should.equal(1);
        done();
      });
    });
  });

  describe('#_getBalanceFromMempool', function() {
    it('will sum satoshis', function() {
      var sparksd = new sparksService(baseConfig);
      var deltas = [
        {
          satoshis: -1000,
        },
        {
          satoshis: 2000,
        },
        {
          satoshis: -10,
        }
      ];
      var sum = sparksd._getBalanceFromMempool(deltas);
      sum.should.equal(990);
    });
  });

  describe('#_getTxidsFromMempool', function() {
    it('will filter to txids', function() {
      var sparksd = new sparksService(baseConfig);
      var deltas = [
        {
          txid: 'txid0',
        },
        {
          txid: 'txid1',
        },
        {
          txid: 'txid2',
        }
      ];
      var txids = sparksd._getTxidsFromMempool(deltas);
      txids.length.should.equal(3);
      txids[0].should.equal('txid0');
      txids[1].should.equal('txid1');
      txids[2].should.equal('txid2');
    });
    it('will not include duplicates', function() {
      var sparksd = new sparksService(baseConfig);
      var deltas = [
        {
          txid: 'txid0',
        },
        {
          txid: 'txid0',
        },
        {
          txid: 'txid1',
        }
      ];
      var txids = sparksd._getTxidsFromMempool(deltas);
      txids.length.should.equal(2);
      txids[0].should.equal('txid0');
      txids[1].should.equal('txid1');
    });
  });

  describe('#_getHeightRangeQuery', function() {
    it('will detect range query', function() {
      var sparksd = new sparksService(baseConfig);
      var options = {
        start: 20,
        end: 0
      };
      var rangeQuery = sparksd._getHeightRangeQuery(options);
      rangeQuery.should.equal(true);
    });
    it('will get range properties', function() {
      var sparksd = new sparksService(baseConfig);
      var options = {
        start: 20,
        end: 0
      };
      var clone = {};
      sparksd._getHeightRangeQuery(options, clone);
      clone.end.should.equal(20);
      clone.start.should.equal(0);
    });
    it('will throw error with invalid range', function() {
      var sparksd = new sparksService(baseConfig);
      var options = {
        start: 0,
        end: 20
      };
      (function() {
        sparksd._getHeightRangeQuery(options);
      }).should.throw('"end" is expected');
    });
  });

  describe('#getAddressTxids', function() {
    it('will give error from _getHeightRangeQuery', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._getHeightRangeQuery = sinon.stub().throws(new Error('test'));
      sparksd.getAddressTxids('address', {}, function(err) {
        err.should.be.instanceOf(Error);
        err.message.should.equal('test');
        done();
      });
    });
    it('will give rpc error from mempool query', function() {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getAddressMempool: sinon.stub().callsArgWith(1, {code: -1, message: 'Test error'})
        }
      });
      var options = {};
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressTxids(address, options, function(err) {
        should.exist(err);
        err.should.be.instanceof(errors.RPCError);
      });
    });
    it('will give rpc error from txids query', function() {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getAddressTxids: sinon.stub().callsArgWith(1, {code: -1, message: 'Test error'})
        }
      });
      var options = {
        queryMempool: false
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressTxids(address, options, function(err) {
        should.exist(err);
        err.should.be.instanceof(errors.RPCError);
      });
    });
    it('will get txid results', function(done) {
      var expectedTxids = [
        'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
        'f637384e9f81f18767ea50e00bce58fc9848b6588a1130529eebba22a410155f',
        'f3c1ba3ef86a0420d6102e40e2cfc8682632ab95d09d86a27f5d466b9fa9da47',
        '56fafeb01961831b926558d040c246b97709fd700adcaa916541270583e8e579',
        'bc992ad772eb02864db07ef248d31fb3c6826d25f1153ebf8c79df9b7f70fcf2',
        'f71bccef3a8f5609c7f016154922adbfe0194a96fb17a798c24077c18d0a9345',
        'f35e7e2a2334e845946f3eaca76890d9a68f4393ccc9fe37a0c2fb035f66d2e9',
        'edc080f2084eed362aa488ccc873a24c378dc0979aa29b05767517b70569414a',
        'ed11a08e3102f9610bda44c80c46781d97936a4290691d87244b1b345b39a693',
        'ec94d845c603f292a93b7c829811ac624b76e52b351617ca5a758e9d61a11681'
      ];
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getAddressTxids: sinon.stub().callsArgWith(1, null, {
            result: expectedTxids.reverse()
          })
        }
      });
      var options = {
        queryMempool: false
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressTxids(address, options, function(err, txids) {
        if (err) {
          return done(err);
        }
        txids.length.should.equal(expectedTxids.length);
        txids.should.deep.equal(expectedTxids);
        done();
      });
    });
    it('will get txid results from cache', function(done) {
      var expectedTxids = [
        'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce'
      ];
      var sparksd = new sparksService(baseConfig);
      var getAddressTxids = sinon.stub().callsArgWith(1, null, {
        result: expectedTxids.reverse()
      });
      sparksd.nodes.push({
        client: {
          getAddressTxids: getAddressTxids
        }
      });
      var options = {
        queryMempool: false
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressTxids(address, options, function(err, txids) {
        if (err) {
          return done(err);
        }
        getAddressTxids.callCount.should.equal(1);
        txids.should.deep.equal(expectedTxids);

        sparksd.getAddressTxids(address, options, function(err, txids) {
          if (err) {
            return done(err);
          }
          getAddressTxids.callCount.should.equal(1);
          txids.should.deep.equal(expectedTxids);
          done();
        });
      });
    });
    it('will get txid results WITHOUT cache if rangeQuery and exclude mempool', function(done) {
      var expectedTxids = [
        'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce'
      ];
      var sparksd = new sparksService(baseConfig);
      var getAddressMempool = sinon.stub();
      var getAddressTxids = sinon.stub().callsArgWith(1, null, {
        result: expectedTxids.reverse()
      });
      sparksd.nodes.push({
        client: {
          getAddressTxids: getAddressTxids,
          getAddressMempool: getAddressMempool
        }
      });
      var options = {
        queryMempool: true, // start and end will exclude mempool
        start: 4,
        end: 2
      };
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressTxids(address, options, function(err, txids) {
        if (err) {
          return done(err);
        }
        getAddressTxids.callCount.should.equal(1);
        getAddressMempool.callCount.should.equal(0);
        txids.should.deep.equal(expectedTxids);

        sparksd.getAddressTxids(address, options, function(err, txids) {
          if (err) {
            return done(err);
          }
          getAddressTxids.callCount.should.equal(2);
          getAddressMempool.callCount.should.equal(0);
          txids.should.deep.equal(expectedTxids);
          done();
        });
      });
    });
    it('will get txid results from cache and live mempool', function(done) {
      var expectedTxids = [
        'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce'
      ];
      var sparksd = new sparksService(baseConfig);
      var getAddressTxids = sinon.stub().callsArgWith(1, null, {
        result: expectedTxids.reverse()
      });
      var getAddressMempool = sinon.stub().callsArgWith(1, null, {
        result: [
          {
            txid: 'bc992ad772eb02864db07ef248d31fb3c6826d25f1153ebf8c79df9b7f70fcf2'
          },
          {
            txid: 'f71bccef3a8f5609c7f016154922adbfe0194a96fb17a798c24077c18d0a9345'
          },
          {
            txid: 'f35e7e2a2334e845946f3eaca76890d9a68f4393ccc9fe37a0c2fb035f66d2e9'
          }
        ]
      });
      sparksd.nodes.push({
        client: {
          getAddressTxids: getAddressTxids,
          getAddressMempool: getAddressMempool
        }
      });
      var address = 'XnQuJpAgEDNtRwoXWLfuEs69cMgCYS8rgs';
      sparksd.getAddressTxids(address, {queryMempool: false}, function(err, txids) {
        if (err) {
          return done(err);
        }
        getAddressTxids.callCount.should.equal(1);
        txids.should.deep.equal(expectedTxids);

        sparksd.getAddressTxids(address, {queryMempool: true}, function(err, txids) {
          if (err) {
            return done(err);
          }
          getAddressTxids.callCount.should.equal(1);
          txids.should.deep.equal([
            'f35e7e2a2334e845946f3eaca76890d9a68f4393ccc9fe37a0c2fb035f66d2e9', // mempool
            'f71bccef3a8f5609c7f016154922adbfe0194a96fb17a798c24077c18d0a9345', // mempool
            'bc992ad772eb02864db07ef248d31fb3c6826d25f1153ebf8c79df9b7f70fcf2', // mempool
            'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce' // confirmed
          ]);
          done();
        });
      });
    });
  });

  describe('#_getConfirmationDetail', function() {
    var sandbox = sinon.sandbox.create();
    beforeEach(function() {
      sandbox.stub(log, 'warn');
    });
    afterEach(function() {
      sandbox.restore();
    });
    it('should get 0 confirmation', function() {
      var tx = new Transaction(txhex);
      tx.height = -1;
      var sparksd = new sparksService(baseConfig);
      sparksd.height = 10;
      var confirmations = sparksd._getConfirmationsDetail(tx);
      confirmations.should.equal(0);
    });
    it('should get 1 confirmation', function() {
      var tx = new Transaction(txhex);
      tx.height = 10;
      var sparksd = new sparksService(baseConfig);
      sparksd.height = 10;
      var confirmations = sparksd._getConfirmationsDetail(tx);
      confirmations.should.equal(1);
    });
    it('should get 2 confirmation', function() {
      var sparksd = new sparksService(baseConfig);
      var tx = new Transaction(txhex);
      sparksd.height = 11;
      tx.height = 10;
      var confirmations = sparksd._getConfirmationsDetail(tx);
      confirmations.should.equal(2);
    });
    it('should get 0 confirmation with overflow', function() {
      var sparksd = new sparksService(baseConfig);
      var tx = new Transaction(txhex);
      sparksd.height = 3;
      tx.height = 10;
      var confirmations = sparksd._getConfirmationsDetail(tx);
      log.warn.callCount.should.equal(1);
      confirmations.should.equal(0);
    });
    it('should get 1000 confirmation', function() {
      var sparksd = new sparksService(baseConfig);
      var tx = new Transaction(txhex);
      sparksd.height = 1000;
      tx.height = 1;
      var confirmations = sparksd._getConfirmationsDetail(tx);
      confirmations.should.equal(1000);
    });
  });

  describe('#_getAddressDetailsForInput', function() {
    it('will return if missing an address', function() {
      var sparksd = new sparksService(baseConfig);
      var result = {};
      sparksd._getAddressDetailsForInput({}, 0, result, []);
      should.not.exist(result.addresses);
      should.not.exist(result.satoshis);
    });
    it('will only add address if it matches', function() {
      var sparksd = new sparksService(baseConfig);
      var result = {};
      sparksd._getAddressDetailsForInput({
        address: 'address1'
      }, 0, result, ['address2']);
      should.not.exist(result.addresses);
      should.not.exist(result.satoshis);
    });
    it('will instantiate if outputIndexes not defined', function() {
      var sparksd = new sparksService(baseConfig);
      var result = {
        addresses: {}
      };
      sparksd._getAddressDetailsForInput({
        address: 'address1'
      }, 0, result, ['address1']);
      should.exist(result.addresses);
      result.addresses['address1'].inputIndexes.should.deep.equal([0]);
      result.addresses['address1'].outputIndexes.should.deep.equal([]);
    });
    it('will push to inputIndexes', function() {
      var sparksd = new sparksService(baseConfig);
      var result = {
        addresses: {
          'address1': {
            inputIndexes: [1]
          }
        }
      };
      sparksd._getAddressDetailsForInput({
        address: 'address1'
      }, 2, result, ['address1']);
      should.exist(result.addresses);
      result.addresses['address1'].inputIndexes.should.deep.equal([1, 2]);
    });
  });

  describe('#_getAddressDetailsForOutput', function() {
    it('will return if missing an address', function() {
      var sparksd = new sparksService(baseConfig);
      var result = {};
      sparksd._getAddressDetailsForOutput({}, 0, result, []);
      should.not.exist(result.addresses);
      should.not.exist(result.satoshis);
    });
    it('will only add address if it matches', function() {
      var sparksd = new sparksService(baseConfig);
      var result = {};
      sparksd._getAddressDetailsForOutput({
        address: 'address1'
      }, 0, result, ['address2']);
      should.not.exist(result.addresses);
      should.not.exist(result.satoshis);
    });
    it('will instantiate if outputIndexes not defined', function() {
      var sparksd = new sparksService(baseConfig);
      var result = {
        addresses: {}
      };
      sparksd._getAddressDetailsForOutput({
        address: 'address1'
      }, 0, result, ['address1']);
      should.exist(result.addresses);
      result.addresses['address1'].inputIndexes.should.deep.equal([]);
      result.addresses['address1'].outputIndexes.should.deep.equal([0]);
    });
    it('will push if outputIndexes defined', function() {
      var sparksd = new sparksService(baseConfig);
      var result = {
        addresses: {
          'address1': {
            outputIndexes: [0]
          }
        }
      };
      sparksd._getAddressDetailsForOutput({
        address: 'address1'
      }, 1, result, ['address1']);
      should.exist(result.addresses);
      result.addresses['address1'].outputIndexes.should.deep.equal([0, 1]);
    });
  });

  describe('#_getAddressDetailsForTransaction', function() {
    it('will calculate details for the transaction', function(done) {
      /* jshint sub:true */
      var tx = {
        inputs: [
          {
            satoshis: 1000000000,
            address: 'mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW'
          }
        ],
        outputs: [
          {
            satoshis: 100000000,
            address: 'mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW'
          },
          {
            satoshis: 200000000,
            address: 'mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW'
          },
          {
            satoshis: 50000000,
            address: 'mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW'
          },
          {
            satoshis: 300000000,
            address: 'mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW'
          },
          {
            satoshis: 349990000,
            address: 'mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW'
          }
        ],
        locktime: 0
      };
      var sparksd = new sparksService(baseConfig);
      var addresses = ['mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW'];
      var details = sparksd._getAddressDetailsForTransaction(tx, addresses);
      should.exist(details.addresses['mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW']);
      details.addresses['mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW'].inputIndexes.should.deep.equal([0]);
      details.addresses['mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW'].outputIndexes.should.deep.equal([
        0, 1, 2, 3, 4
      ]);
      details.satoshis.should.equal(-10000);
      done();
    });
  });

  describe('#_getAddressDetailedTransaction', function() {
    it('will get detailed transaction info', function(done) {
      var txid = '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0';
      var tx = {
        height: 20,
      };
      var sparksd = new sparksService(baseConfig);
      sparksd.getDetailedTransaction = sinon.stub().callsArgWith(1, null, tx);
      sparksd.height = 300;
      var addresses = {};
      sparksd._getAddressDetailsForTransaction = sinon.stub().returns({
        addresses: addresses,
        satoshis: 1000,
      });
      sparksd._getAddressDetailedTransaction(txid, {}, function(err, details) {
        if (err) {
          return done(err);
        }
        details.addresses.should.equal(addresses);
        details.satoshis.should.equal(1000);
        details.confirmations.should.equal(281);
        details.tx.should.equal(tx);
        done();
      });
    });
    it('give error from getDetailedTransaction', function(done) {
      var txid = '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0';
      var sparksd = new sparksService(baseConfig);
      sparksd.getDetailedTransaction = sinon.stub().callsArgWith(1, new Error('test'));
      sparksd._getAddressDetailedTransaction(txid, {}, function(err) {
        err.should.be.instanceof(Error);
        done();
      });
    });
  });

  describe('#_getAddressStrings', function() {
    it('will get address strings from sparkscore addresses', function() {
      var addresses = [
        sparkscore.Address('XjxDQFjTNEP9dcrJhBLvy5i1Dobz4x1LJN'),
        sparkscore.Address('7d5169eBcGHF4BYC6DTffTyeCpWbrZnNgz'),
      ];
      var sparksd = new sparksService(baseConfig);
      var strings = sparksd._getAddressStrings(addresses);
      strings[0].should.equal('XjxDQFjTNEP9dcrJhBLvy5i1Dobz4x1LJN');
      strings[1].should.equal('7d5169eBcGHF4BYC6DTffTyeCpWbrZnNgz');
    });
    it('will get address strings from strings', function() {
      var addresses = [
        'XjxDQFjTNEP9dcrJhBLvy5i1Dobz4x1LJN',
        '7d5169eBcGHF4BYC6DTffTyeCpWbrZnNgz',
      ];
      var sparksd = new sparksService(baseConfig);
      var strings = sparksd._getAddressStrings(addresses);
      strings[0].should.equal('XjxDQFjTNEP9dcrJhBLvy5i1Dobz4x1LJN');
      strings[1].should.equal('7d5169eBcGHF4BYC6DTffTyeCpWbrZnNgz');
    });
    it('will get address strings from mixture of types', function() {
      var addresses = [
        sparkscore.Address('XjxDQFjTNEP9dcrJhBLvy5i1Dobz4x1LJN'),
        '7d5169eBcGHF4BYC6DTffTyeCpWbrZnNgz',
      ];
      var sparksd = new sparksService(baseConfig);
      var strings = sparksd._getAddressStrings(addresses);
      strings[0].should.equal('XjxDQFjTNEP9dcrJhBLvy5i1Dobz4x1LJN');
      strings[1].should.equal('7d5169eBcGHF4BYC6DTffTyeCpWbrZnNgz');
    });
    it('will give error with unknown', function() {
      var addresses = [
        sparkscore.Address('XjxDQFjTNEP9dcrJhBLvy5i1Dobz4x1LJN'),
        0,
      ];
      var sparksd = new sparksService(baseConfig);
      (function() {
        sparksd._getAddressStrings(addresses);
      }).should.throw(TypeError);
    });
  });

  describe('#_paginateTxids', function() {
    it('slice txids based on "from" and "to" (3 to 13)', function() {
      var sparksd = new sparksService(baseConfig);
      var txids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      var paginated = sparksd._paginateTxids(txids, 3, 13);
      paginated.should.deep.equal([3, 4, 5, 6, 7, 8, 9, 10]);
    });
    it('slice txids based on "from" and "to" (0 to 3)', function() {
      var sparksd = new sparksService(baseConfig);
      var txids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      var paginated = sparksd._paginateTxids(txids, 0, 3);
      paginated.should.deep.equal([0, 1, 2]);
    });
    it('slice txids based on "from" and "to" (0 to 1)', function() {
      var sparksd = new sparksService(baseConfig);
      var txids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      var paginated = sparksd._paginateTxids(txids, 0, 1);
      paginated.should.deep.equal([0]);
    });
    it('will throw error if "from" is greater than "to"', function() {
      var sparksd = new sparksService(baseConfig);
      var txids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      (function() {
        sparksd._paginateTxids(txids, 1, 0);
      }).should.throw('"from" (1) is expected to be less than "to"');
    });
    it('will handle string numbers', function() {
      var sparksd = new sparksService(baseConfig);
      var txids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      var paginated = sparksd._paginateTxids(txids, '1', '3');
      paginated.should.deep.equal([1, 2]);
    });
  });

  describe('#getAddressHistory', function() {
    var address = 'XcHw3hNN293dY1AYrbeBrP1sB6vsugTQTz';
    it('will give error with "from" and "to" range that exceeds max size', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.getAddressHistory(address, {from: 0, to: 51}, function(err) {
        should.exist(err);
        err.message.match(/^\"from/);
        done();
      });
    });
    it('will give error with "from" and "to" order is reversed', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.getAddressTxids = sinon.stub().callsArgWith(2, null, []);
      sparksd.getAddressHistory(address, {from: 51, to: 0}, function(err) {
        should.exist(err);
        err.message.match(/^\"from/);
        done();
      });
    });
    it('will give error from _getAddressDetailedTransaction', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.getAddressTxids = sinon.stub().callsArgWith(2, null, ['txid']);
      sparksd._getAddressDetailedTransaction = sinon.stub().callsArgWith(2, new Error('test'));
      sparksd.getAddressHistory(address, {}, function(err) {
        should.exist(err);
        err.message.should.equal('test');
        done();
      });
    });
    it('will give an error if length of addresses is too long', function(done) {
      var addresses = [];
      for (var i = 0; i < 101; i++) {
        addresses.push(address);
      }
      var sparksd = new sparksService(baseConfig);
      sparksd.maxAddressesQuery = 100;
      sparksd.getAddressHistory(addresses, {}, function(err) {
        should.exist(err);
        err.message.match(/Maximum/);
        done();
      });
    });
    it('give error from getAddressTxids', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.getAddressTxids = sinon.stub().callsArgWith(2, new Error('test'));
      sparksd.getAddressHistory('address', {}, function(err) {
        should.exist(err);
        err.should.be.instanceof(Error);
        err.message.should.equal('test');
        done();
      });
    });
    it('will paginate', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._getAddressDetailedTransaction = function(txid, options, callback) {
        callback(null, txid);
      };
      var txids = ['one', 'two', 'three', 'four'];
      sparksd.getAddressTxids = sinon.stub().callsArgWith(2, null, txids);
      sparksd.getAddressHistory('address', {from: 1, to: 3}, function(err, data) {
        if (err) {
          return done(err);
        }
        data.items.length.should.equal(2);
        data.items.should.deep.equal(['two', 'three']);
        done();
      });
    });
  });

  describe('#getAddressSummary', function() {
    var txid1 = '70d9d441d7409aace8e0ffe24ff0190407b2fcb405799a266e0327017288d1f8';
    var txid2 = '35fafaf572341798b2ce2858755afa7c8800bb6b1e885d3e030b81255b5e172d';
    var txid3 = '57b7842afc97a2b46575b490839df46e9273524c6ea59ba62e1e86477cf25247';
    var memtxid1 = 'b1bfa8dbbde790cb46b9763ef3407c1a21c8264b67bfe224f462ec0e1f569e92';
    var memtxid2 = 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce';
    it('will handle error from getAddressTxids', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getAddressMempool: sinon.stub().callsArgWith(1, null, {
            result: [
              {
                txid: '70d9d441d7409aace8e0ffe24ff0190407b2fcb405799a266e0327017288d1f8',
              }
            ]
          })
        }
      });
      sparksd.getAddressTxids = sinon.stub().callsArgWith(2, new Error('test'));
      sparksd.getAddressBalance = sinon.stub().callsArgWith(2, null, {});
      var address = '';
      var options = {};
      sparksd.getAddressSummary(address, options, function(err) {
        should.exist(err);
        err.should.be.instanceof(Error);
        err.message.should.equal('test');
        done();
      });
    });
    it('will handle error from getAddressBalance', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getAddressMempool: sinon.stub().callsArgWith(1, null, {
            result: [
              {
                txid: '70d9d441d7409aace8e0ffe24ff0190407b2fcb405799a266e0327017288d1f8',
              }
            ]
          })
        }
      });
      sparksd.getAddressTxids = sinon.stub().callsArgWith(2, null, {});
      sparksd.getAddressBalance = sinon.stub().callsArgWith(2, new Error('test'), {});
      var address = '';
      var options = {};
      sparksd.getAddressSummary(address, options, function(err) {
        should.exist(err);
        err.should.be.instanceof(Error);
        err.message.should.equal('test');
        done();
      });
    });
    it('will handle error from client getAddressMempool', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getAddressMempool: sinon.stub().callsArgWith(1, {code: -1, message: 'Test error'})
        }
      });
      sparksd.getAddressTxids = sinon.stub().callsArgWith(2, null, {});
      sparksd.getAddressBalance = sinon.stub().callsArgWith(2, null, {});
      var address = '';
      var options = {};
      sparksd.getAddressSummary(address, options, function(err) {
        should.exist(err);
        err.should.be.instanceof(Error);
        err.message.should.equal('Test error');
        done();
      });
    });
    it('should set all properties', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getAddressMempool: sinon.stub().callsArgWith(1, null, {
            result: [
              {
                txid: memtxid1,
                satoshis: -1000000
              },
              {
                txid: memtxid2,
                satoshis: 99999
              }
            ]
          })
        }
      });
      sinon.spy(sparksd, '_paginateTxids');
      sparksd.getAddressTxids = sinon.stub().callsArgWith(2, null, [txid1, txid2, txid3]);
      sparksd.getAddressBalance = sinon.stub().callsArgWith(2, null, {
        received: 30 * 1e8,
        balance: 20 * 1e8
      });
      var address = '7oK6xjGeVK5YCT5dpqzNXGUag1bQadPAyT';
      var options = {};
      sparksd.getAddressSummary(address, options, function(err, summary) {
        sparksd._paginateTxids.callCount.should.equal(1);
        sparksd._paginateTxids.args[0][1].should.equal(0);
        sparksd._paginateTxids.args[0][2].should.equal(1000);
        summary.appearances.should.equal(3);
        summary.totalReceived.should.equal(3000000000);
        summary.totalSpent.should.equal(1000000000);
        summary.balance.should.equal(2000000000);
        summary.unconfirmedAppearances.should.equal(2);
        summary.unconfirmedBalance.should.equal(-900001);
        summary.txids.should.deep.equal([
          'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
          'b1bfa8dbbde790cb46b9763ef3407c1a21c8264b67bfe224f462ec0e1f569e92',
          '70d9d441d7409aace8e0ffe24ff0190407b2fcb405799a266e0327017288d1f8',
          '35fafaf572341798b2ce2858755afa7c8800bb6b1e885d3e030b81255b5e172d',
          '57b7842afc97a2b46575b490839df46e9273524c6ea59ba62e1e86477cf25247'
        ]);
        done();
      });
    });
    it('will give error with "from" and "to" range that exceeds max size', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getAddressMempool: sinon.stub().callsArgWith(1, null, {
            result: [
              {
                txid: memtxid1,
                satoshis: -1000000
              },
              {
                txid: memtxid2,
                satoshis: 99999
              }
            ]
          })
        }
      });
      sparksd.getAddressTxids = sinon.stub().callsArgWith(2, null, [txid1, txid2, txid3]);
      sparksd.getAddressBalance = sinon.stub().callsArgWith(2, null, {
        received: 30 * 1e8,
        balance: 20 * 1e8
      });
      var address = '7oK6xjGeVK5YCT5dpqzNXGUag1bQadPAyT';
      var options = {
        from: 0,
        to: 1001
      };
      sparksd.getAddressSummary(address, options, function(err) {
        should.exist(err);
        err.message.match(/^\"from/);
        done();
      });
    });
    it('will get from cache with noTxList', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getAddressMempool: sinon.stub().callsArgWith(1, null, {
            result: [
              {
                txid: memtxid1,
                satoshis: -1000000
              },
              {
                txid: memtxid2,
                satoshis: 99999
              }
            ]
          })
        }
      });
      sparksd.getAddressTxids = sinon.stub().callsArgWith(2, null, [txid1, txid2, txid3]);
      sparksd.getAddressBalance = sinon.stub().callsArgWith(2, null, {
        received: 30 * 1e8,
        balance: 20 * 1e8
      });
      var address = '7oK6xjGeVK5YCT5dpqzNXGUag1bQadPAyT';
      var options = {
        noTxList: true
      };
      function checkSummary(summary) {
        summary.appearances.should.equal(3);
        summary.totalReceived.should.equal(3000000000);
        summary.totalSpent.should.equal(1000000000);
        summary.balance.should.equal(2000000000);
        summary.unconfirmedAppearances.should.equal(2);
        summary.unconfirmedBalance.should.equal(-900001);
        should.not.exist(summary.txids);
      }
      sparksd.getAddressSummary(address, options, function(err, summary) {
        checkSummary(summary);
        sparksd.getAddressTxids.callCount.should.equal(1);
        sparksd.getAddressBalance.callCount.should.equal(1);
        sparksd.getAddressSummary(address, options, function(err, summary) {
          checkSummary(summary);
          sparksd.getAddressTxids.callCount.should.equal(1);
          sparksd.getAddressBalance.callCount.should.equal(1);
          done();
        });
      });
    });
    it('will skip querying the mempool with queryMempool set to false', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getAddressMempool = sinon.stub();
      sparksd.nodes.push({
        client: {
          getAddressMempool: getAddressMempool
        }
      });
      sinon.spy(sparksd, '_paginateTxids');
      sparksd.getAddressTxids = sinon.stub().callsArgWith(2, null, [txid1, txid2, txid3]);
      sparksd.getAddressBalance = sinon.stub().callsArgWith(2, null, {
        received: 30 * 1e8,
        balance: 20 * 1e8
      });
      var address = '7oK6xjGeVK5YCT5dpqzNXGUag1bQadPAyT';
      var options = {
        queryMempool: false
      };
      sparksd.getAddressSummary(address, options, function() {
        getAddressMempool.callCount.should.equal(0);
        done();
      });
    });
    it('will give error from _paginateTxids', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getAddressMempool = sinon.stub();
      sparksd.nodes.push({
        client: {
          getAddressMempool: getAddressMempool
        }
      });
      sinon.spy(sparksd, '_paginateTxids');
      sparksd.getAddressTxids = sinon.stub().callsArgWith(2, null, [txid1, txid2, txid3]);
      sparksd.getAddressBalance = sinon.stub().callsArgWith(2, null, {
        received: 30 * 1e8,
        balance: 20 * 1e8
      });
      sparksd._paginateTxids = sinon.stub().throws(new Error('test'));
      var address = '7oK6xjGeVK5YCT5dpqzNXGUag1bQadPAyT';
      var options = {
        queryMempool: false
      };
      sparksd.getAddressSummary(address, options, function(err) {
        err.should.be.instanceOf(Error);
        err.message.should.equal('test');
        done();
      });
    });
  });

  describe('#getRawBlock', function() {
    var blockhash = '00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b';
    var blockhex = '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c0101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000';
    it('will give rcp error from client getblockhash', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getBlockHash: sinon.stub().callsArgWith(1, {code: -1, message: 'Test error'})
        }
      });
      sparksd.getRawBlock(10, function(err) {
        should.exist(err);
        err.should.be.instanceof(errors.RPCError);
        done();
      });
    });
    it('will give rcp error from client getblock', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getBlock: sinon.stub().callsArgWith(2, {code: -1, message: 'Test error'})
        }
      });
      sparksd.getRawBlock(blockhash, function(err) {
        should.exist(err);
        err.should.be.instanceof(errors.RPCError);
        done();
      });
    });
    it('will try all nodes for getblock', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlockWithError = sinon.stub().callsArgWith(2, {code: -1, message: 'Test error'});
      sparksd.tryAllInterval = 1;
      sparksd.nodes.push({
        client: {
          getBlock: getBlockWithError
        }
      });
      sparksd.nodes.push({
        client: {
          getBlock: getBlockWithError
        }
      });
      sparksd.nodes.push({
        client: {
          getBlock: sinon.stub().callsArgWith(2, null, {
            result: blockhex
          })
        }
      });
      //cause first call will be not getBlock, but _maybeGetBlockHash, which will set up nodesIndex to 0
      sparksd.nodesIndex = 2;
      sparksd.getRawBlock(blockhash, function(err, buffer) {
        if (err) {
          return done(err);
        }
        buffer.should.be.instanceof(Buffer);
        getBlockWithError.callCount.should.equal(2);
        done();
      });
    });
    it('will get block from cache', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlock = sinon.stub().callsArgWith(2, null, {
        result: blockhex
      });
      sparksd.nodes.push({
        client: {
          getBlock: getBlock
        }
      });
      sparksd.getRawBlock(blockhash, function(err, buffer) {
        if (err) {
          return done(err);
        }
        buffer.should.be.instanceof(Buffer);
        getBlock.callCount.should.equal(1);
        sparksd.getRawBlock(blockhash, function(err, buffer) {
          if (err) {
            return done(err);
          }
          buffer.should.be.instanceof(Buffer);
          getBlock.callCount.should.equal(1);
          done();
        });
      });
    });
    it('will get block by height', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlock = sinon.stub().callsArgWith(2, null, {
        result: blockhex
      });
      var getBlockHash = sinon.stub().callsArgWith(1, null, {
        result: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f'
      });
      sparksd.nodes.push({
        client: {
          getBlock: getBlock,
          getBlockHash: getBlockHash
        }
      });
      sparksd.getRawBlock(0, function(err, buffer) {
        if (err) {
          return done(err);
        }
        buffer.should.be.instanceof(Buffer);
        getBlock.callCount.should.equal(1);
        getBlockHash.callCount.should.equal(1);
        done();
      });
    });
  });

  describe('#getBlock', function() {
    var blockhex = '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c0101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000';
    it('will give an rpc error from client getblock', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlock = sinon.stub().callsArgWith(2, {code: -1, message: 'Test error'});
      var getBlockHash = sinon.stub().callsArgWith(1, null, {});
      sparksd.nodes.push({
        client: {
          getBlock: getBlock,
          getBlockHash: getBlockHash
        }
      });
      sparksd.getBlock(0, function(err) {
        err.should.be.instanceof(Error);
        done();
      });
    });
    it('will give an rpc error from client getblockhash', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlockHash = sinon.stub().callsArgWith(1, {code: -1, message: 'Test error'});
      sparksd.nodes.push({
        client: {
          getBlockHash: getBlockHash
        }
      });
      sparksd.getBlock(0, function(err) {
        err.should.be.instanceof(Error);
        done();
      });
    });
    it('will getblock as sparkscore object from height', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlock = sinon.stub().callsArgWith(2, null, {
        result: blockhex
      });
      var getBlockHash = sinon.stub().callsArgWith(1, null, {
        result: '00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b'
      });
      sparksd.nodes.push({
        client: {
          getBlock: getBlock,
          getBlockHash: getBlockHash
        }
      });
      sparksd.getBlock(0, function(err, block) {
        should.not.exist(err);
        getBlock.args[0][0].should.equal('00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b');
        getBlock.args[0][1].should.equal(false);
        block.should.be.instanceof(sparkscore.Block);
        done();
      });
    });
    it('will getblock as sparkscore object', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlock = sinon.stub().callsArgWith(2, null, {
        result: blockhex
      });
      var getBlockHash = sinon.stub();
      sparksd.nodes.push({
        client: {
          getBlock: getBlock,
          getBlockHash: getBlockHash
        }
      });
      sparksd.getBlock('00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b', function(err, block) {
        should.not.exist(err);
        getBlockHash.callCount.should.equal(0);
        getBlock.callCount.should.equal(1);
        getBlock.args[0][0].should.equal('00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b');
        getBlock.args[0][1].should.equal(false);
        block.should.be.instanceof(sparkscore.Block);
        done();
      });
    });
    it('will get block from cache', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlock = sinon.stub().callsArgWith(2, null, {
        result: blockhex
      });
      var getBlockHash = sinon.stub();
      sparksd.nodes.push({
        client: {
          getBlock: getBlock,
          getBlockHash: getBlockHash
        }
      });
      var hash = '00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b';
      sparksd.getBlock(hash, function(err, block) {
        should.not.exist(err);
        getBlockHash.callCount.should.equal(0);
        getBlock.callCount.should.equal(1);
        block.should.be.instanceof(sparkscore.Block);
        sparksd.getBlock(hash, function(err, block) {
          should.not.exist(err);
          getBlockHash.callCount.should.equal(0);
          getBlock.callCount.should.equal(1);
          block.should.be.instanceof(sparkscore.Block);
          done();
        });
      });
    });
    it('will get block from cache with height (but not height)', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlock = sinon.stub().callsArgWith(2, null, {
        result: blockhex
      });
      var getBlockHash = sinon.stub().callsArgWith(1, null, {
        result: '00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b'
      });
      sparksd.nodes.push({
        client: {
          getBlock: getBlock,
          getBlockHash: getBlockHash
        }
      });
      sparksd.getBlock(0, function(err, block) {
        should.not.exist(err);
        getBlockHash.callCount.should.equal(1);
        getBlock.callCount.should.equal(1);
        block.should.be.instanceof(sparkscore.Block);
        sparksd.getBlock(0, function(err, block) {
          should.not.exist(err);
          getBlockHash.callCount.should.equal(2);
          getBlock.callCount.should.equal(1);
          block.should.be.instanceof(sparkscore.Block);
          done();
        });
      });
    });
  });

  describe('#getBlockHashesByTimestamp', function() {
    it('should give an rpc error', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlockHashes = sinon.stub().callsArgWith(2, {message: 'error', code: -1});
      sparksd.nodes.push({
        client: {
          getBlockHashes: getBlockHashes
        }
      });
      sparksd.getBlockHashesByTimestamp(1441911000, 1441914000, function(err, hashes) {
        should.exist(err);
        err.message.should.equal('error');
        done();
      });
    });
    it('should get the correct block hashes', function(done) {
      var sparksd = new sparksService(baseConfig);
      var block1 = '00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b';
      var block2 = '000000000383752a55a0b2891ce018fd0fdc0b6352502772b034ec282b4a1bf6';
      var getBlockHashes = sinon.stub().callsArgWith(2, null, {
        result: [block2, block1]
      });
      sparksd.nodes.push({
        client: {
          getBlockHashes: getBlockHashes
        }
      });
      sparksd.getBlockHashesByTimestamp(1441914000, 1441911000, function(err, hashes) {
        should.not.exist(err);
        hashes.should.deep.equal([block2, block1]);
        done();
      });
    });
  });

  describe('#getBlockHeader', function() {
    var blockhash = '00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b';
    it('will give error from getBlockHash', function() {
      var sparksd = new sparksService(baseConfig);
      var getBlockHash = sinon.stub().callsArgWith(1, {code: -1, message: 'Test error'});
      sparksd.nodes.push({
        client: {
          getBlockHash: getBlockHash
        }
      });
      sparksd.getBlockHeader(10, function(err) {
        err.should.be.instanceof(Error);
      });
    });
    it('it will give rpc error from client getblockheader', function() {
      var sparksd = new sparksService(baseConfig);
      var getBlockHeader = sinon.stub().callsArgWith(1, {code: -1, message: 'Test error'});
      sparksd.nodes.push({
        client: {
          getBlockHeader: getBlockHeader
        }
      });
      sparksd.getBlockHeader(blockhash, function(err) {
        err.should.be.instanceof(Error);
      });
    });
    it('it will give rpc error from client getblockhash', function() {
      var sparksd = new sparksService(baseConfig);
      var getBlockHeader = sinon.stub();
      var getBlockHash = sinon.stub().callsArgWith(1, {code: -1, message: 'Test error'});
      sparksd.nodes.push({
        client: {
          getBlockHeader: getBlockHeader,
          getBlockHash: getBlockHash
        }
      });
      sparksd.getBlockHeader(0, function(err) {
        err.should.be.instanceof(Error);
      });
    });
    it('will give result from client getblockheader (from height)', function() {
      var sparksd = new sparksService(baseConfig);
      var result = {
        hash: '0000000000000a817cd3a74aec2f2246b59eb2cbb1ad730213e6c4a1d68ec2f6',
        version: 536870912,
        confirmations: 5,
        height: 828781,
        chainWork: '00000000000000000000000000000000000000000000000ad467352c93bc6a3b',
        prevHash: '0000000000000504235b2aff578a48470dbf6b94dafa9b3703bbf0ed554c9dd9',
        nextHash: '00000000000000eedd967ec155f237f033686f0924d574b946caf1b0e89551b8',
        merkleRoot: '124e0f3fb5aa268f102b0447002dd9700988fc570efcb3e0b5b396ac7db437a9',
        time: 1462979126,
        medianTime: 1462976771,
        nonce: 2981820714,
        bits: '1a13ca10',
        difficulty: 847779.0710240941
      };
      var getBlockHeader = sinon.stub().callsArgWith(1, null, {
        result: {
          hash: '0000000000000a817cd3a74aec2f2246b59eb2cbb1ad730213e6c4a1d68ec2f6',
          version: 536870912,
          confirmations: 5,
          height: 828781,
          chainwork: '00000000000000000000000000000000000000000000000ad467352c93bc6a3b',
          previousblockhash: '0000000000000504235b2aff578a48470dbf6b94dafa9b3703bbf0ed554c9dd9',
          nextblockhash: '00000000000000eedd967ec155f237f033686f0924d574b946caf1b0e89551b8',
          merkleroot: '124e0f3fb5aa268f102b0447002dd9700988fc570efcb3e0b5b396ac7db437a9',
          time: 1462979126,
          mediantime: 1462976771,
          nonce: 2981820714,
          bits: '1a13ca10',
          difficulty: 847779.0710240941
        }
      });
      var getBlockHash = sinon.stub().callsArgWith(1, null, {
        result: blockhash
      });
      sparksd.nodes.push({
        client: {
          getBlockHeader: getBlockHeader,
          getBlockHash: getBlockHash
        }
      });
      sparksd.getBlockHeader(0, function(err, blockHeader) {
        should.not.exist(err);
        getBlockHeader.args[0][0].should.equal(blockhash);
        blockHeader.should.deep.equal(result);
      });
    });
    it('will give result from client getblockheader (from hash)', function() {
      var sparksd = new sparksService(baseConfig);
      var result = {
        hash: '0000000000000a817cd3a74aec2f2246b59eb2cbb1ad730213e6c4a1d68ec2f6',
        version: 536870912,
        confirmations: 5,
        height: 828781,
        chainWork: '00000000000000000000000000000000000000000000000ad467352c93bc6a3b',
        prevHash: '0000000000000504235b2aff578a48470dbf6b94dafa9b3703bbf0ed554c9dd9',
        nextHash: '00000000000000eedd967ec155f237f033686f0924d574b946caf1b0e89551b8',
        merkleRoot: '124e0f3fb5aa268f102b0447002dd9700988fc570efcb3e0b5b396ac7db437a9',
        time: 1462979126,
        medianTime: 1462976771,
        nonce: 2981820714,
        bits: '1a13ca10',
        difficulty: 847779.0710240941
      };
      var getBlockHeader = sinon.stub().callsArgWith(1, null, {
        result: {
          hash: '0000000000000a817cd3a74aec2f2246b59eb2cbb1ad730213e6c4a1d68ec2f6',
          version: 536870912,
          confirmations: 5,
          height: 828781,
          chainwork: '00000000000000000000000000000000000000000000000ad467352c93bc6a3b',
          previousblockhash: '0000000000000504235b2aff578a48470dbf6b94dafa9b3703bbf0ed554c9dd9',
          nextblockhash: '00000000000000eedd967ec155f237f033686f0924d574b946caf1b0e89551b8',
          merkleroot: '124e0f3fb5aa268f102b0447002dd9700988fc570efcb3e0b5b396ac7db437a9',
          time: 1462979126,
          mediantime: 1462976771,
          nonce: 2981820714,
          bits: '1a13ca10',
          difficulty: 847779.0710240941
        }
      });
      var getBlockHash = sinon.stub();
      sparksd.nodes.push({
        client: {
          getBlockHeader: getBlockHeader,
          getBlockHash: getBlockHash
        }
      });
      sparksd.getBlockHeader(blockhash, function(err, blockHeader) {
        should.not.exist(err);
        getBlockHash.callCount.should.equal(0);
        blockHeader.should.deep.equal(result);
      });
    });
  });

  describe('#getBlockHeaders', function(){
      var blockhash = '00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b';
      it('will gave error from getBlockHash', function(){
          var sparksd = new sparksService(baseConfig);
          var getBlockHash = sinon.stub().callsArgWith(1, {code: -1, message: 'Test error'});
          sparksd.nodes.push({
              client: {
                  getBlockHash: getBlockHash
              }
          });
          sparksd.getBlockHeaders(10, function(err) {
              err.should.be.instanceof(Error);
          });
      });
      it('it will give rpc error from client getblockheaders', function() {
          var sparksd = new sparksService(baseConfig);
          var getBlockHeader = sinon.stub().callsArgWith(1, {code: -1, message: 'Test error'});
          sparksd.nodes.push({
              client: {
                  getBlockHeader: getBlockHeader
              }
          });
          sparksd.getBlockHeaders(blockhash, function(err){
              err.should.be.instanceof(Error);
          });
      });
      it("will get an array of block headers", function(){
          var sparksd = new sparksService(baseConfig);

          var result = {
              hash: '0000000000000a817cd3a74aec2f2246b59eb2cbb1ad730213e6c4a1d68ec2f6',
              version: 536870912,
              confirmations: 5,
              height: 828781,
              chainWork: '00000000000000000000000000000000000000000000000ad467352c93bc6a3b',
              prevHash: '0000000000000504235b2aff578a48470dbf6b94dafa9b3703bbf0ed554c9dd9',
              nextHash: '00000000000000eedd967ec155f237f033686f0924d574b946caf1b0e89551b8',
              merkleRoot: '124e0f3fb5aa268f102b0447002dd9700988fc570efcb3e0b5b396ac7db437a9',
              time: 1462979126,
              medianTime: 1462976771,
              nonce: 2981820714,
              bits: '1a13ca10',
              difficulty: 847779.0710240941
          };
          var _blockHash = "0000000000004244572caa69779a8e0a6d09fa426856b55cffc1dbc9060cab0d";
          var getBlockHeader = sinon.stub().callsArgWith(1, null, {
              result: {
                  hash: '0000000000004244572caa69779a8e0a6d09fa426856b55cffc1dbc9060cab0d',
                  version: 3,
                  confirmations: 3,
                  height: 596802,
                  size:1011,
                  chainwork: '0000000000000000000000000000000000000000000000013b107cbccb2955f0',
                  previousblockhash: '0000000000002c6816b083abb8cd8d1e2b13181d39e62b456807a4ccecaccf0d',
                  nextblockhash: '00000000000012093f65b9fdba40c4131270a90158864ea422f0ab6acc12ec08',
                  merkleroot: '5aed5d0acabaaea2463f50333f4bebd9b661af1b6cbf620750dead86c53c8a32',
                  tx: [
                      "ad86010c4acfb66d1dd5ce00eeba936396a8a002cc324e7126316e9d48b34a2d",
                      "35ca72c44ae96cab5fe80c22bf72b48324e31242eba7030dec407f0948e6662f",
                      "bfb5c2b60ca73376339185e93b9eac1027655b62da04bacdb502607606598c8d"
                  ],
                  time: 1483290225,
                  nonce: 268203724,
                  bits: '1b00d5dd',
                  difficulty: 78447.12707081
              }
          });
          var getBlockHash = sinon.stub().callsArgWith(1, null, {
              result: "0000000000004244572caa69779a8e0a6d09fa426856b55cffc1dbc9060cab0d"
          });

          var _blockHash2 = "00000000000012093f65b9fdba40c4131270a90158864ea422f0ab6acc12ec08";

          var getBlockHeader2 = sinon.stub().callsArgWith(1, null, {
              result: {
                  hash: '00000000000012093f65b9fdba40c4131270a90158864ea422f0ab6acc12ec08',
                  version: 3,
                  confirmations: 2,
                  height: 596803,
                  size:9004,
                  chainwork: '0000000000000000000000000000000000000000000000013b11b1f8dc564404',
                  previousblockhash: '0000000000004244572caa69779a8e0a6d09fa426856b55cffc1dbc9060cab0d',
                  nextblockhash: '0000000000007dbd3e7b09b457c57436e8f15e76d33768bce1e879678c8699b9',
                  merkleroot: '7e1301c4edd06a61c9081738ef6c704e5b5622680c8a5d6bb9d68f177c645915',
                  tx: [
                      "b0614db089313a5c572cd1b4abd0e7924c6ed8e14092d55f3b1b539935dc1579",
                      "aba6bf61c5eea6a7b215e95f3a881ef259d9b720476c3f3ac453155bbf041d6e",
                      "080acf0b48929bced37bd5bb28217fc0eb98876fc5afbeba9598c641e670dca7",
                      "0ec875ccd7e69cd3c2d44b67b617e4120fdc3447754e6610e75dd2227c9e9b32",
                      "bd0db2ea00c12b31ab21c565f55b0d6534074aced6208d6076219ff35e7fab79",
                      "006a1c7ff5ffc369ee542ba959aad69a993a7923feb60b68e15984dd71c6baa0",
                      "aa41c6780e5f1b54192f97ef11ef5adaf27e15da94f924ffe8317a3e72f00a42"
                  ],
                  time: 1483290547,
                  nonce: 3123079945,
                  bits: '1b00d3ee',
                  difficulty: 79162.85914403
              }
          });
          var getBlockHash2 = sinon.stub().callsArgWith(1, null, {
              result: "00000000000012093f65b9fdba40c4131270a90158864ea422f0ab6acc12ec08"
          });
          sparksd.nodes.push({
              client: {
                  getBlockHeader: getBlockHeader,
                  getBlockHash: getBlockHash
              }
          });
          sparksd.nodes.push({
              client: {
                  getBlockHeader: getBlockHeader2,
                  getBlockHash: getBlockHash2
              }
          });

          sparksd.getBlockHeaders(_blockHash, function(err, blockHeader){
              should.not.exist(err);
              blockHeader[0].hash.should.equal(_blockHash);
              // getBlockHeader.args[0][0].should.equal(blockhash);
              // blockHeader.should.deep.equal(result);
          },5);
      });
  });

  describe('#_maybeGetBlockHash', function() {
    it('will not get block hash with an address', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlockHash = sinon.stub();
      sparksd.nodes.push({
        client: {
          getBlockHash: getBlockHash
        }
      });
      sparksd._maybeGetBlockHash('8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi', function(err, hash) {
        if (err) {
          return done(err);
        }
        getBlockHash.callCount.should.equal(0);
        hash.should.equal('8oUSpiq5REeEKAzS1qSXoJbZ9TRfH1L6mi');
        done();
      });
    });
    it('will not get block hash with non zero-nine numeric string', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlockHash = sinon.stub();
      sparksd.nodes.push({
        client: {
          getBlockHash: getBlockHash
        }
      });
      sparksd._maybeGetBlockHash('109a', function(err, hash) {
        if (err) {
          return done(err);
        }
        getBlockHash.callCount.should.equal(0);
        hash.should.equal('109a');
        done();
      });
    });
    it('will get the block hash if argument is a number', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlockHash = sinon.stub().callsArgWith(1, null, {
        result: 'blockhash'
      });
      sparksd.nodes.push({
        client: {
          getBlockHash: getBlockHash
        }
      });
      sparksd._maybeGetBlockHash(10, function(err, hash) {
        if (err) {
          return done(err);
        }
        hash.should.equal('blockhash');
        getBlockHash.callCount.should.equal(1);
        done();
      });
    });
    it('will get the block hash if argument is a number (as string)', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlockHash = sinon.stub().callsArgWith(1, null, {
        result: 'blockhash'
      });
      sparksd.nodes.push({
        client: {
          getBlockHash: getBlockHash
        }
      });
      sparksd._maybeGetBlockHash('10', function(err, hash) {
        if (err) {
          return done(err);
        }
        hash.should.equal('blockhash');
        getBlockHash.callCount.should.equal(1);
        done();
      });
    });
    it('will try multiple nodes if one fails', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlockHash = sinon.stub().callsArgWith(1, null, {
        result: 'blockhash'
      });
      getBlockHash.onCall(0).callsArgWith(1, {code: -1, message: 'test'});
      sparksd.tryAllInterval = 1;
      sparksd.nodes.push({
        client: {
          getBlockHash: getBlockHash
        }
      });
      sparksd.nodes.push({
        client: {
          getBlockHash: getBlockHash
        }
      });
      sparksd._maybeGetBlockHash(10, function(err, hash) {
        if (err) {
          return done(err);
        }
        hash.should.equal('blockhash');
        getBlockHash.callCount.should.equal(2);
        done();
      });
    });
    it('will give error from getBlockHash', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlockHash = sinon.stub().callsArgWith(1, {code: -1, message: 'test'});
      sparksd.tryAllInterval = 1;
      sparksd.nodes.push({
        client: {
          getBlockHash: getBlockHash
        }
      });
      sparksd.nodes.push({
        client: {
          getBlockHash: getBlockHash
        }
      });
      sparksd._maybeGetBlockHash(10, function(err, hash) {
        getBlockHash.callCount.should.equal(2);
        err.should.be.instanceOf(Error);
        err.message.should.equal('test');
        err.code.should.equal(-1);
        done();
      });
    });
  });

  describe('#getBlockOverview', function() {
    var blockhash = '00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b';
    it('will handle error from maybeGetBlockHash', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd._maybeGetBlockHash = sinon.stub().callsArgWith(1, new Error('test'));
      sparksd.getBlockOverview(blockhash, function(err) {
        err.should.be.instanceOf(Error);
        done();
      });
    });
    it('will give error from client.getBlock', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBlock = sinon.stub().callsArgWith(2, {code: -1, message: 'test'});
      sparksd.nodes.push({
        client: {
          getBlock: getBlock
        }
      });
      sparksd.getBlockOverview(blockhash, function(err) {
        err.should.be.instanceOf(Error);
        err.message.should.equal('test');
        done();
      });
    });
    it('will give expected result', function(done) {
      var sparksd = new sparksService(baseConfig);
      var blockResult = {
        hash: blockhash,
        version: 536870912,
        confirmations: 5,
        height: 828781,
        chainwork: '00000000000000000000000000000000000000000000000ad467352c93bc6a3b',
        previousblockhash: '0000000000000504235b2aff578a48470dbf6b94dafa9b3703bbf0ed554c9dd9',
        nextblockhash: '00000000000000eedd967ec155f237f033686f0924d574b946caf1b0e89551b8',
        merkleroot: '124e0f3fb5aa268f102b0447002dd9700988fc570efcb3e0b5b396ac7db437a9',
        time: 1462979126,
        mediantime: 1462976771,
        nonce: 2981820714,
        bits: '1a13ca10',
        difficulty: 847779.0710240941
      };
      var getBlock = sinon.stub().callsArgWith(2, null, {
        result: blockResult
      });
      sparksd.nodes.push({
        client: {
          getBlock: getBlock
        }
      });
      function checkBlock(blockOverview) {
        blockOverview.hash.should.equal('00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b');
        blockOverview.version.should.equal(536870912);
        blockOverview.confirmations.should.equal(5);
        blockOverview.height.should.equal(828781);
        blockOverview.chainWork.should.equal('00000000000000000000000000000000000000000000000ad467352c93bc6a3b');
        blockOverview.prevHash.should.equal('0000000000000504235b2aff578a48470dbf6b94dafa9b3703bbf0ed554c9dd9');
        blockOverview.nextHash.should.equal('00000000000000eedd967ec155f237f033686f0924d574b946caf1b0e89551b8');
        blockOverview.merkleRoot.should.equal('124e0f3fb5aa268f102b0447002dd9700988fc570efcb3e0b5b396ac7db437a9');
        blockOverview.time.should.equal(1462979126);
        blockOverview.medianTime.should.equal(1462976771);
        blockOverview.nonce.should.equal(2981820714);
        blockOverview.bits.should.equal('1a13ca10');
        blockOverview.difficulty.should.equal(847779.0710240941);
      }
      sparksd.getBlockOverview(blockhash, function(err, blockOverview) {
        if (err) {
          return done(err);
        }
        checkBlock(blockOverview);
        sparksd.getBlockOverview(blockhash, function(err, blockOverview) {
          checkBlock(blockOverview);
          getBlock.callCount.should.equal(1);
          done();
        });
      });
    });
  });

  describe('#estimateFee', function() {
    it('will give rpc error', function(done) {
      var sparksd = new sparksService(baseConfig);
      var estimateFee = sinon.stub().callsArgWith(1, {message: 'error', code: -1});
      sparksd.nodes.push({
        client: {
          estimateFee: estimateFee
        }
      });
      sparksd.estimateFee(1, function(err) {
        should.exist(err);
        err.should.be.an.instanceof(errors.RPCError);
        done();
      });
    });
    it('will call client estimateFee and give result', function(done) {
      var sparksd = new sparksService(baseConfig);
      var estimateFee = sinon.stub().callsArgWith(1, null, {
        result: -1
      });
      sparksd.nodes.push({
        client: {
          estimateFee: estimateFee
        }
      });
      sparksd.estimateFee(1, function(err, feesPerKb) {
        if (err) {
          return done(err);
        }
        feesPerKb.should.equal(-1);
        done();
      });
    });
  });

  describe('#sendTransaction', function(done) {
    var tx = sparkscore.Transaction(txhex);
    it('will give rpc error', function() {
      var sparksd = new sparksService(baseConfig);
      var sendRawTransaction = sinon.stub().callsArgWith(3, {message: 'error', code: -1});
      sparksd.nodes.push({
        client: {
          sendRawTransaction: sendRawTransaction
        }
      });
      sparksd.sendTransaction(txhex, function(err) {
        should.exist(err);
        err.should.be.an.instanceof(errors.RPCError);
      });
    });
    it('will send to client and get hash', function() {
      var sparksd = new sparksService(baseConfig);
      var sendRawTransaction = sinon.stub().callsArgWith(3, null, {
        result: tx.hash
      });
      sparksd.nodes.push({
        client: {
          sendRawTransaction: sendRawTransaction
        }
      });
      sparksd.sendTransaction(txhex, function(err, hash) {
        if (err) {
          return done(err);
        }
        hash.should.equal(tx.hash);
      });
    });
    it('will send to client with absurd fees and get hash', function() {
      var sparksd = new sparksService(baseConfig);
      var sendRawTransaction = sinon.stub().callsArgWith(3, null, {
        result: tx.hash
      });
      sparksd.nodes.push({
        client: {
          sendRawTransaction: sendRawTransaction
        }
      });
      sparksd.sendTransaction(txhex, {allowAbsurdFees: true}, function(err, hash) {
        if (err) {
          return done(err);
        }
        hash.should.equal(tx.hash);
      });
    });
    it('missing callback will throw error', function() {
      var sparksd = new sparksService(baseConfig);
      var sendRawTransaction = sinon.stub().callsArgWith(3, null, {
        result: tx.hash
      });
      sparksd.nodes.push({
        client: {
          sendRawTransaction: sendRawTransaction
        }
      });
      var transaction = sparkscore.Transaction();
      (function() {
        sparksd.sendTransaction(transaction);
      }).should.throw(Error);
    });
  });

  describe('#getRawTransaction', function() {
    it('will give rpc error', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getRawTransaction = sinon.stub().callsArgWith(1, {message: 'error', code: -1});
      sparksd.nodes.push({
        client: {
          getRawTransaction: getRawTransaction
        }
      });
      sparksd.getRawTransaction('txid', function(err) {
        should.exist(err);
        err.should.be.an.instanceof(errors.RPCError);
        done();
      });
    });
    it('will try all nodes', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.tryAllInterval = 1;
      var getRawTransactionWithError = sinon.stub().callsArgWith(1, {message: 'error', code: -1});
      var getRawTransaction = sinon.stub().callsArgWith(1, null, {
        result: txhex
      });
      sparksd.nodes.push({
        client: {
          getRawTransaction: getRawTransactionWithError
        }
      });
      sparksd.nodes.push({
        client: {
          getRawTransaction: getRawTransactionWithError
        }
      });
      sparksd.nodes.push({
        client: {
          getRawTransaction: getRawTransaction
        }
      });
      sparksd.getRawTransaction('txid', function(err, tx) {
        if (err) {
          return done(err);
        }
        should.exist(tx);
        tx.should.be.an.instanceof(Buffer);
        done();
      });
    });
    it('will get from cache', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getRawTransaction = sinon.stub().callsArgWith(1, null, {
        result: txhex
      });
      sparksd.nodes.push({
        client: {
          getRawTransaction: getRawTransaction
        }
      });
      sparksd.getRawTransaction('txid', function(err, tx) {
        if (err) {
          return done(err);
        }
        should.exist(tx);
        tx.should.be.an.instanceof(Buffer);

        sparksd.getRawTransaction('txid', function(err, tx) {
          should.exist(tx);
          tx.should.be.an.instanceof(Buffer);
          getRawTransaction.callCount.should.equal(1);
          done();
        });
      });
    });
  });

  describe('#getTransaction', function() {
    it('will give rpc error', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getRawTransaction = sinon.stub().callsArgWith(1, {message: 'error', code: -1});
      sparksd.nodes.push({
        client: {
          getRawTransaction: getRawTransaction
        }
      });
      sparksd.getTransaction('txid', function(err) {
        should.exist(err);
        err.should.be.an.instanceof(errors.RPCError);
        done();
      });
    });
    it('will try all nodes', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.tryAllInterval = 1;
      var getRawTransactionWithError = sinon.stub().callsArgWith(1, {message: 'error', code: -1});
      var getRawTransaction = sinon.stub().callsArgWith(1, null, {
        result: txhex
      });
      sparksd.nodes.push({
        client: {
          getRawTransaction: getRawTransactionWithError
        }
      });
      sparksd.nodes.push({
        client: {
          getRawTransaction: getRawTransactionWithError
        }
      });
      sparksd.nodes.push({
        client: {
          getRawTransaction: getRawTransaction
        }
      });
      sparksd.getTransaction('txid', function(err, tx) {
        if (err) {
          return done(err);
        }
        should.exist(tx);
        tx.should.be.an.instanceof(sparkscore.Transaction);
        done();
      });
    });
    it('will get from cache', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getRawTransaction = sinon.stub().callsArgWith(1, null, {
        result: txhex
      });
      sparksd.nodes.push({
        client: {
          getRawTransaction: getRawTransaction
        }
      });
      sparksd.getTransaction('txid', function(err, tx) {
        if (err) {
          return done(err);
        }
        should.exist(tx);
        tx.should.be.an.instanceof(sparkscore.Transaction);

        sparksd.getTransaction('txid', function(err, tx) {
          should.exist(tx);
          tx.should.be.an.instanceof(sparkscore.Transaction);
          getRawTransaction.callCount.should.equal(1);
          done();
        });

      });
    });
  });

  describe('#getDetailedTransaction', function() {
    var txBuffer = new Buffer('01000000016f95980911e01c2c664b3e78299527a47933aac61a515930a8fe0213d1ac9abe01000000da0047304402200e71cda1f71e087c018759ba3427eb968a9ea0b1decd24147f91544629b17b4f0220555ee111ed0fc0f751ffebf097bdf40da0154466eb044e72b6b3dcd5f06807fa01483045022100c86d6c8b417bff6cc3bbf4854c16bba0aaca957e8f73e19f37216e2b06bb7bf802205a37be2f57a83a1b5a8cc511dc61466c11e9ba053c363302e7b99674be6a49fc0147522102632178d046673c9729d828cfee388e121f497707f810c131e0d3fc0fe0bd66d62103a0951ec7d3a9da9de171617026442fcd30f34d66100fab539853b43f508787d452aeffffffff0240420f000000000017a9148a31d53a448c18996e81ce67811e5fb7da21e4468738c9d6f90000000017a9148ce5408cfeaddb7ccb2545ded41ef478109454848700000000', 'hex');
    var info = {
      blockHash: '00000000000ec715852ea2ecae4dc8563f62d603c820f81ac284cd5be0a944d6',
      height: 530482,
      timestamp: 1439559434000,
      buffer: txBuffer
    };
    var rpcRawTransaction = {
      hex: txBuffer.toString('hex'),
      blockhash: info.blockHash,
      height: info.height,
      version: 1,
      locktime: 411451,
      time: info.timestamp,
      vin: [
        {
          valueSat: 110,
          address: 'mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW',
          txid: '3d003413c13eec3fa8ea1fe8bbff6f40718c66facffe2544d7516c9e2900cac2',
          sequence: 0xFFFFFFFF,
          vout: 0,
          scriptSig: {
            hex: 'scriptSigHex',
            asm: 'scriptSigAsm'
          }
        }
      ],
      vout: [
        {
          spentTxId: '4316b98e7504073acd19308b4b8c9f4eeb5e811455c54c0ebfe276c0b1eb6315',
          spentIndex: 2,
          spentHeight: 100,
          valueSat: 100,
          scriptPubKey: {
            hex: '76a9140b2f0a0c31bfe0406b0ccc1381fdbe311946dadc88ac',
            asm: 'OP_DUP OP_HASH160 0b2f0a0c31bfe0406b0ccc1381fdbe311946dadc OP_EQUALVERIFY OP_CHECKSIG',
            addresses: ['mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW']
          }
        }
      ]
    };
    it('should give a transaction with height and timestamp', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.nodes.push({
        client: {
          getRawTransaction: sinon.stub().callsArgWith(2, {code: -1, message: 'Test error'})
        }
      });
      var txid = '2d950d00494caf6bfc5fff2a3f839f0eb50f663ae85ce092bc5f9d45296ae91f';
      sparksd.getDetailedTransaction(txid, function(err) {
        should.exist(err);
        err.should.be.instanceof(errors.RPCError);
        done();
      });
    });
    it('should give a transaction with all properties', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getRawTransaction = sinon.stub().callsArgWith(2, null, {
        result: rpcRawTransaction
      });
      sparksd.nodes.push({
        client: {
          getRawTransaction: getRawTransaction
        }
      });
      var txid = '2d950d00494caf6bfc5fff2a3f839f0eb50f663ae85ce092bc5f9d45296ae91f';
      function checkTx(tx) {
        /* jshint maxstatements: 30 */
        should.exist(tx);
        should.not.exist(tx.coinbase);
        should.equal(tx.hex, txBuffer.toString('hex'));
        should.equal(tx.blockHash, '00000000000ec715852ea2ecae4dc8563f62d603c820f81ac284cd5be0a944d6');
        should.equal(tx.height, 530482);
        should.equal(tx.blockTimestamp, 1439559434000);
        should.equal(tx.version, 1);
        should.equal(tx.locktime, 411451);
        should.equal(tx.feeSatoshis, 10);
        should.equal(tx.inputSatoshis, 110);
        should.equal(tx.outputSatoshis, 100);
        should.equal(tx.hash, txid);
        var input = tx.inputs[0];
        should.equal(input.prevTxId, '3d003413c13eec3fa8ea1fe8bbff6f40718c66facffe2544d7516c9e2900cac2');
        should.equal(input.outputIndex, 0);
        should.equal(input.satoshis, 110);
        should.equal(input.sequence, 0xFFFFFFFF);
        should.equal(input.script, 'scriptSigHex');
        should.equal(input.scriptAsm, 'scriptSigAsm');
        should.equal(input.address, 'mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW');
        var output = tx.outputs[0];
        should.equal(output.satoshis, 100);
        should.equal(output.script, '76a9140b2f0a0c31bfe0406b0ccc1381fdbe311946dadc88ac');
        should.equal(output.scriptAsm, 'OP_DUP OP_HASH160 0b2f0a0c31bfe0406b0ccc1381fdbe311946dadc OP_EQUALVERIFY OP_CHECKSIG');
        should.equal(output.address, 'mgY65WSfEmsyYaYPQaXhmXMeBhwp4EcsQW');
        should.equal(output.spentTxId, '4316b98e7504073acd19308b4b8c9f4eeb5e811455c54c0ebfe276c0b1eb6315');
        should.equal(output.spentIndex, 2);
        should.equal(output.spentHeight, 100);
      }
      sparksd.getDetailedTransaction(txid, function(err, tx) {
        if (err) {
          return done(err);
        }
        checkTx(tx);
        sparksd.getDetailedTransaction(txid, function(err, tx) {
          if (err) {
            return done(err);
          }
          checkTx(tx);
          getRawTransaction.callCount.should.equal(1);
          done();
        });
      });
    });
    it('should set coinbase to true', function(done) {
      var sparksd = new sparksService(baseConfig);
      var rawTransaction = JSON.parse((JSON.stringify(rpcRawTransaction)));
      delete rawTransaction.vin[0];
      rawTransaction.vin = [
        {
          coinbase: 'abcdef'
        }
      ];
      sparksd.nodes.push({
        client: {
          getRawTransaction: sinon.stub().callsArgWith(2, null, {
            result: rawTransaction
          })
        }
      });
      var txid = '2d950d00494caf6bfc5fff2a3f839f0eb50f663ae85ce092bc5f9d45296ae91f';
      sparksd.getDetailedTransaction(txid, function(err, tx) {
        should.exist(tx);
        should.equal(tx.coinbase, true);
        done();
      });
    });
    it('will not include address if address length is zero', function(done) {
      var sparksd = new sparksService(baseConfig);
      var rawTransaction = JSON.parse((JSON.stringify(rpcRawTransaction)));
      rawTransaction.vout[0].scriptPubKey.addresses = [];
      sparksd.nodes.push({
        client: {
          getRawTransaction: sinon.stub().callsArgWith(2, null, {
            result: rawTransaction
          })
        }
      });
      var txid = '2d950d00494caf6bfc5fff2a3f839f0eb50f663ae85ce092bc5f9d45296ae91f';
      sparksd.getDetailedTransaction(txid, function(err, tx) {
        should.exist(tx);
        should.equal(tx.outputs[0].address, null);
        done();
      });
    });
    it('will not include address if address length is greater than 1', function(done) {
      var sparksd = new sparksService(baseConfig);
      var rawTransaction = JSON.parse((JSON.stringify(rpcRawTransaction)));
      rawTransaction.vout[0].scriptPubKey.addresses = ['one', 'two'];
      sparksd.nodes.push({
        client: {
          getRawTransaction: sinon.stub().callsArgWith(2, null, {
            result: rawTransaction
          })
        }
      });
      var txid = '2d950d00494caf6bfc5fff2a3f839f0eb50f663ae85ce092bc5f9d45296ae91f';
      sparksd.getDetailedTransaction(txid, function(err, tx) {
        should.exist(tx);
        should.equal(tx.outputs[0].address, null);
        done();
      });
    });
    it('will handle scriptPubKey.addresses not being set', function(done) {
      var sparksd = new sparksService(baseConfig);
      var rawTransaction = JSON.parse((JSON.stringify(rpcRawTransaction)));
      delete rawTransaction.vout[0].scriptPubKey['addresses'];
      sparksd.nodes.push({
        client: {
          getRawTransaction: sinon.stub().callsArgWith(2, null, {
            result: rawTransaction
          })
        }
      });
      var txid = '2d950d00494caf6bfc5fff2a3f839f0eb50f663ae85ce092bc5f9d45296ae91f';
      sparksd.getDetailedTransaction(txid, function(err, tx) {
        should.exist(tx);
        should.equal(tx.outputs[0].address, null);
        done();
      });
    });
    it('will not include script if input missing scriptSig or coinbase', function(done) {
      var sparksd = new sparksService(baseConfig);
      var rawTransaction = JSON.parse((JSON.stringify(rpcRawTransaction)));
      delete rawTransaction.vin[0].scriptSig;
      delete rawTransaction.vin[0].coinbase;
      sparksd.nodes.push({
        client: {
          getRawTransaction: sinon.stub().callsArgWith(2, null, {
            result: rawTransaction
          })
        }
      });
      var txid = '2d950d00494caf6bfc5fff2a3f839f0eb50f663ae85ce092bc5f9d45296ae91f';
      sparksd.getDetailedTransaction(txid, function(err, tx) {
        should.exist(tx);
        should.equal(tx.inputs[0].script, null);
        done();
      });
    });
    it('will set height to -1 if missing height', function(done) {
      var sparksd = new sparksService(baseConfig);
      var rawTransaction = JSON.parse((JSON.stringify(rpcRawTransaction)));
      delete rawTransaction.height;
      sparksd.nodes.push({
        client: {
          getRawTransaction: sinon.stub().callsArgWith(2, null, {
            result: rawTransaction
          })
        }
      });
      var txid = '2d950d00494caf6bfc5fff2a3f839f0eb50f663ae85ce092bc5f9d45296ae91f';
      sparksd.getDetailedTransaction(txid, function(err, tx) {
        should.exist(tx);
        should.equal(tx.height, -1);
        done();
      });
    });
  });

  describe('#getBestBlockHash', function() {
    it('will give rpc error', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBestBlockHash = sinon.stub().callsArgWith(0, {message: 'error', code: -1});
      sparksd.nodes.push({
        client: {
          getBestBlockHash: getBestBlockHash
        }
      });
      sparksd.getBestBlockHash(function(err) {
        should.exist(err);
        err.should.be.an.instanceof(errors.RPCError);
        done();
      });
    });
    it('will call client getInfo and give result', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getBestBlockHash = sinon.stub().callsArgWith(0, null, {
        result: 'besthash'
      });
      sparksd.nodes.push({
        client: {
          getBestBlockHash: getBestBlockHash
        }
      });
      sparksd.getBestBlockHash(function(err, hash) {
        if (err) {
          return done(err);
        }
        should.exist(hash);
        hash.should.equal('besthash');
        done();
      });
    });
  });

  describe('#getSpentInfo', function() {
    it('will give rpc error', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getSpentInfo = sinon.stub().callsArgWith(1, {message: 'error', code: -1});
      sparksd.nodes.push({
        client: {
          getSpentInfo: getSpentInfo
        }
      });
      sparksd.getSpentInfo({}, function(err) {
        should.exist(err);
        err.should.be.an.instanceof(errors.RPCError);
        done();
      });
    });
    it('will empty object when not found', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getSpentInfo = sinon.stub().callsArgWith(1, {message: 'test', code: -5});
      sparksd.nodes.push({
        client: {
          getSpentInfo: getSpentInfo
        }
      });
      sparksd.getSpentInfo({}, function(err, info) {
        should.not.exist(err);
        info.should.deep.equal({});
        done();
      });
    });
    it('will call client getSpentInfo and give result', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getSpentInfo = sinon.stub().callsArgWith(1, null, {
        result: {
          txid: 'txid',
          index: 10,
          height: 101
        }
      });
      sparksd.nodes.push({
        client: {
          getSpentInfo: getSpentInfo
        }
      });
      sparksd.getSpentInfo({}, function(err, info) {
        if (err) {
          return done(err);
        }
        info.txid.should.equal('txid');
        info.index.should.equal(10);
        info.height.should.equal(101);
        done();
      });
    });
  });

  describe('#getInfo', function() {
    it('will give rpc error', function(done) {
      var sparksd = new sparksService(baseConfig);
      var getInfo = sinon.stub().callsArgWith(0, {message: 'error', code: -1});
      sparksd.nodes.push({
        client: {
          getInfo: getInfo
        }
      });
      sparksd.getInfo(function(err) {
        should.exist(err);
        err.should.be.an.instanceof(errors.RPCError);
        done();
      });
    });
    it('will call client getInfo and give result', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.node.getNetworkName = sinon.stub().returns('testnet');
      var getInfo = sinon.stub().callsArgWith(0, null, {
        result: {
          version: 1,
          protocolversion: 1,
          blocks: 1,
          timeoffset: 1,
          connections: 1,
          proxy: '',
          difficulty: 1,
          testnet: true,
          relayfee: 10,
          errors: ''
        }
      });
      sparksd.nodes.push({
        client: {
          getInfo: getInfo
        }
      });
      sparksd.getInfo(function(err, info) {
        if (err) {
          return done(err);
        }
        should.exist(info);
        should.equal(info.version, 1);
        should.equal(info.protocolVersion, 1);
        should.equal(info.blocks, 1);
        should.equal(info.timeOffset, 1);
        should.equal(info.connections, 1);
        should.equal(info.proxy, '');
        should.equal(info.difficulty, 1);
        should.equal(info.testnet, true);
        should.equal(info.relayFee, 10);
        should.equal(info.errors, '');
        info.network.should.equal('testnet');
        done();
      });
    });
  });

  describe('#govObject', function() {
    it('will call client gobject list and give result', function(done) {
        var sparksd = new sparksService(baseConfig);
        var gobject = sinon.stub().callsArgWith(1, null, {
            result: [{
                "Hash": "9ce5609d41b88fca51dd3f4ad098467cf8c6f2c1b2adf93a6862a7b9bdf01a00",
                "DataHex": "5b5b2270726f706f73616c222c7b22656e645f65706f6368223a313438343830393436302c226e616d65223a2264363534366361353232363730633664303039333662393562323766666233393631643063663234222c227061796d656e745f61646472657373223a22796a42746b73586b47483731693341346d6e374b7848793975634d6473717a756b57222c227061796d656e745f616d6f756e74223a332c2273746172745f65706f6368223a313438343636313730392c2274797065223a312c2275726c223a2268747470733a2f2f7777772e646173682e6f7267227d5d5d",
                "DataObject": {
                    "end_epoch": 1484809460,
                    "name": "d6546ca522670c6d00936b95b27ffb3961d0cf24",
                    "payment_address": "yjBtksXkGH71i3A4mn7KxHy9ucMdsqzukW",
                    "payment_amount": 3,
                    "start_epoch": 1484661709,
                    "type": 1,
                    "url": "https://www.sparks.org"
                },
                "AbsoluteYesCount": 0,
                "YesCount": 0,
                "NoCount": 0,
                "AbstainCount": 0
            }, {
                "Hash": "21af004754d57660a5b83818b26263699b9e25c53a46395b7386e786d1644c00",
                "DataHex": "5b5b2270726f706f73616c222c7b22656e645f65706f6368223a313438343636353636372c226e616d65223a2236306164663935366535313138663331633131353564613866373662396134376464363863306361222c227061796d656e745f61646472657373223a227967684b6f5272526a31696f644c6f684e4e704b52504a5a7673537562367a626756222c227061796d656e745f616d6f756e74223a39382c2273746172745f65706f6368223a313438343635343931352c2274797065223a312c2275726c223a2268747470733a2f2f7777772e646173682e6f7267227d5d5d",
                "DataObject": {
                    "end_epoch": 1484665667,
                    "name": "60adf956e5118f31c1155da8f76b9a47dd68c0ca",
                    "payment_address": "yghKoRrRj1iodLohNNpKRPJZvsSub6zbgV",
                    "payment_amount": 98,
                    "start_epoch": 1484654915,
                    "type": 1,
                    "url": "https://www.sparks.org"
                },
                "AbsoluteYesCount": 0,
                "YesCount": 0,
                "NoCount": 0,
                "AbstainCount": 0
            }, {
                "Hash": "4ef24027c631c43035aa4cf5c672e1298311decd9cffbd16731f454c9c0d6d00",
                "DataHex": "5b5b2270726f706f73616c222c7b22656e645f65706f6368223a313438333835353139332c226e616d65223a2237656139616366663561653833643863396532313764333061326234643130656638663137316638222c227061796d656e745f61646472657373223a22795a3744596b44484348664831647737724b6459614b6356796b5a6d756e62714e4c222c227061796d656e745f616d6f756e74223a38342c2273746172745f65706f6368223a313438333736353238322c2274797065223a312c2275726c223a2268747470733a2f2f7777772e646173682e6f7267227d5d5d",
                "DataObject": {
                    "end_epoch": 1483855193,
                    "name": "7ea9acff5ae83d8c9e217d30a2b4d10ef8f171f8",
                    "payment_address": "yZ7DYkDHCHfH1dw7rKdYaKcVykZmunbqNL",
                    "payment_amount": 84,
                    "start_epoch": 1483765282,
                    "type": 1,
                    "url": "https://www.sparks.org"
                },
                "AbsoluteYesCount": 0,
                "YesCount": 0,
                "NoCount": 0,
                "AbstainCount": 0
            }]
        });
        sparksd.nodes.push({
            client: {
                gobject: gobject
            }
        });
        sparksd.govObjectList({type: 1}, function(err, result) {
            if (err) {
                return done(err);
            }
            should.exist(result);
            should.equal(result.length, 3);
            done();
        });
    });

    it('will call client gobject list and return error', function(done) {
      var sparksd = new sparksService(baseConfig);
      var gobject = sinon.stub().callsArgWith(1, {message: 'error', code: -1});
      sparksd.nodes.push({
        client: {
          gobject: gobject
        }
      });
      sparksd.govObjectList({type: 1}, function(err, result) {
        should.exist(err);
        err.should.be.an.instanceof(errors.RPCError);
        done();
      });
    });

    it('will call client gobject get and give result', function(done) {
      var sparksd = new sparksService(baseConfig);
      var hash = "4ef24027c631c43035aa4cf5c672e1298311decd9cffbd16731f454c9c0d6d00";
      var gobject = sinon.stub().callsArgWith(2, null, {
        result: {
          "DataHex": "5b5b2270726f706f73616c222c7b22656e645f65706f6368223a313438333835353139332c226e616d65223a2237656139616366663561653833643863396532313764333061326234643130656638663137316638222c227061796d656e745f61646472657373223a22795a3744596b44484348664831647737724b6459614b6356796b5a6d756e62714e4c222c227061796d656e745f616d6f756e74223a38342c2273746172745f65706f6368223a313438333736353238322c2274797065223a312c2275726c223a2268747470733a2f2f7777772e646173682e6f7267227d5d5d",
          "DataString": "[[\"proposal\",{\"end_epoch\":1483855193,\"name\":\"7ea9acff5ae83d8c9e217d30a2b4d10ef8f171f8\",\"payment_address\":\"yZ7DYkDHCHfH1dw7rKdYaKcVykZmunbqNL\",\"payment_amount\":84,\"start_epoch\":1483765282,\"type\":1,\"url\":\"https://www.sparks.org\"}]]",
          "Hash": "4ef24027c631c43035aa4cf5c672e1298311decd9cffbd16731f454c9c0d6d00",
          "CollateralHash": "6be3a3ae49498ec8f4e5cba56ac44164aeb78e57f2dbc716f4ff863034830d08",
          "CreationTime": 1483724928,
          "FundingResult": {
            "AbsoluteYesCount": 0,
            "YesCount": 0,
            "NoCount": 0,
            "AbstainCount": 0
          },
          "ValidResult": {
            "AbsoluteYesCount": -11,
            "YesCount": 36,
            "NoCount": 47,
            "AbstainCount": 0
          },
          "DeleteResult": {
            "AbsoluteYesCount": 0,
            "YesCount": 0,
            "NoCount": 0,
            "AbstainCount": 0
          },
          "EndorsedResult": {
            "AbsoluteYesCount": 0,
            "YesCount": 0,
            "NoCount": 0,
            "AbstainCount": 0
          },
          "fLocalValidity": true,
          "IsValidReason": "",
          "fCachedValid": false,
          "fCachedFunding": false,
          "fCachedDelete": false,
          "fCachedEndorsed": false
        }
      });
      sparksd.nodes.push({
        client: {
          gobject: gobject
        }
      });
      sparksd.govObjectHash('4ef24027c631c43035aa4cf5c672e1298311decd9cffbd16731f454c9c0d6d00', function(err, result) {
        if (err) {
          return done(err);
        }
        should.exist(result[0]);

        var DataObject = result[0].DataObject;
        should.equal(DataObject.end_epoch, 1483855193);
        should.equal(DataObject.name, '7ea9acff5ae83d8c9e217d30a2b4d10ef8f171f8');
        should.equal(DataObject.payment_address, 'yZ7DYkDHCHfH1dw7rKdYaKcVykZmunbqNL');
        should.equal(DataObject.payment_amount, 84);
        should.equal(DataObject.start_epoch, 1483765282);
        should.equal(DataObject.type, 1);
        should.equal(DataObject.url, 'https://www.sparks.org');
        done();
      });
    });

    it('will call client gobject get and return error', function(done) {
      var sparksd = new sparksService(baseConfig);
      var gobject = sinon.stub().callsArgWith(2, {message: 'error', code: -1});
      sparksd.nodes.push({
        client: {
          gobject: gobject
        }
      });
      sparksd.govObjectHash('4ef24027c631c43035aa4cf5c672e1298311decd9cffbd16731f454c9c0d6d00', function(err, result) {
        should.exist(err);
        err.should.be.an.instanceof(errors.RPCError);
        done();
      });
    });

  });
	describe('#sporksList', function(){
		it('will call client sporks and give result', function(done){
			var sparksd = new sparksService(baseConfig);

			sparksd.nodes.push({
				client: {
					spork: function(param, callback){
						if(param==="show"){
							callback(null,{result:{
								"SPORK_2_INSTANTSEND_ENABLED":0,
								"SPORK_3_INSTANTSEND_BLOCK_FILTERING":0,
								"SPORK_5_INSTANTSEND_MAX_VALUE":2000,
								"SPORK_8_MASTERNODE_PAYMENT_ENFORCEMENT":0,
								"SPORK_9_SUPERBLOCKS_ENABLED":0,
								"SPORK_10_MASTERNODE_PAY_UPDATED_NODES":0,
								"SPORK_12_RECONSIDER_BLOCKS":0,
								"SPORK_13_OLD_SUPERBLOCK_FLAG":4070908800,
								"SPORK_14_REQUIRE_SENTINEL_FLAG":4070908800
							}
							})
						}
					}
				}
			});
			sparksd.getSpork(function(err, SporkList) {
				if (err) {
					return done(err);
				}
				SporkList.should.have.property('sporks');
				var sporks = SporkList.sporks;
				Object.keys(sporks).length.should.equal(9);
				sporks['SPORK_2_INSTANTSEND_ENABLED'].should.equal(0);
				sporks['SPORK_3_INSTANTSEND_BLOCK_FILTERING'].should.equal(0);
				sporks['SPORK_5_INSTANTSEND_MAX_VALUE'].should.equal(2000);
				sporks['SPORK_8_MASTERNODE_PAYMENT_ENFORCEMENT'].should.equal(0);
				sporks['SPORK_9_SUPERBLOCKS_ENABLED'].should.equal(0);
				sporks['SPORK_10_MASTERNODE_PAY_UPDATED_NODES'].should.equal(0);
				sporks['SPORK_12_RECONSIDER_BLOCKS'].should.equal(0);
				sporks['SPORK_13_OLD_SUPERBLOCK_FLAG'].should.equal(4070908800);
				sporks['SPORK_14_REQUIRE_SENTINEL_FLAG'].should.equal(4070908800);
				done();
			});
		});
	});
  describe('#getMNList', function(){
    it('will call client masternode list and give result', function(done){
	    var sparksd = new sparksService(baseConfig);
	    sparksd.isSynced = function(callback) { return callback(null, true) };
	    sparksd.nodes.push({
		    client: {
			    masternodelist: function(type, cb){
			      switch (type){
                      case "rank":
	                      return cb(null, { result:
		                      { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': 1,
			                      'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': 2}
	                      });
				      case "protocol":
					      return cb(null, { result:
						      { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': 70206,
							      'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': 70206}
					      });
                      case "payee":
	                      return cb(null, { result:
		                      { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': "Xfpp5BxPfFistPPjTe6FucYmtDVmT1GDG3",
			                      'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': "Xn16rfdygfViHe2u36jkDUs9NLmUrUsEKa"}
	                      });
				      case "lastseen":
					      return cb(null, { result:
						      { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': 1502078120,
							      'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': 1502078203}
					      });
				      case "activeseconds":
					      return cb(null, { result:
						      { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': 7016289,
							      'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': 2871829}
					      });
				        break;
				      case "addr":
					      return cb(null, { result:
						      { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': "108.61.209.47:9999",
							      'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': "34.226.228.73:9999"}
					      });
				      case "status":
					      return cb(null, { result:
						      { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': "ENABLED",
							      'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': "ENABLED"}
					      });
                  }
                }
		    }
	    });
	    
	    sparksd.getMNList(function(err, MNList) {
		    if (err) {
			    return done(err);
		    }
		    
		    MNList.length.should.equal(2);
		    MNList[0].vin.should.equal("06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0");
		    MNList[0].status.should.equal("ENABLED");
		    MNList[0].rank.should.equal(1);
		    MNList[0].ip.should.equal("108.61.209.47:9999");
		    MNList[0].protocol.should.equal(70206);
		    MNList[0].payee.should.equal("Xfpp5BxPfFistPPjTe6FucYmtDVmT1GDG3");
		    MNList[0].activeseconds.should.equal(7016289);
		    MNList[0].lastseen.should.equal(1502078120);
		    done();
	    });
    });

    it('will return error if one of nodes not synced yet', function(done){
      var sparksd = new sparksService(baseConfig);
      sparksd.isSynced = function(callback) { return callback(null, false) };
      sparksd.nodes.push({
        client: {
          masternodelist: function(type, cb){
            switch (type){
              case "rank":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': 1,
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': 2}
                });
              case "protocol":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': 70206,
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': 60000}
                });
              case "payee":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': "Xfpp5BxPfFistPPjTe6FucYmtDVmT1GDG3",
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': "Xn16rfdygfViHe2u36jkDUs9NLmUrUsEKa"}
                });
              case "lastseen":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': 1502078120,
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': 1502078203}
                });
              case "activeseconds":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': 7016289,
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': 2871829}
                });
                break;
              case "addr":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': "108.61.209.47:9999",
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': "34.226.228.73:9999"}
                });
              case "status":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': "ENABLED",
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': "ENABLED"}
                });
            }
          }
        }
      });

      sparksd.getMNList(function(err, MNList) {
        err.should.be.instanceof(Error);
        console.log(err);
        done();
      });
    });

    it('will return error if checking synced state of nodes failed', function(done){
      var sparksd = new sparksService(baseConfig);
      sparksd.isSynced = function(callback) { return callback(new Error('Failed')) };
      sparksd.nodes.push({
        client: {
          masternodelist: function(type, cb){
            switch (type){
              case "rank":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': 1,
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': 2}
                });
              case "protocol":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': 70206,
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': 60000}
                });
              case "payee":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': "Xfpp5BxPfFistPPjTe6FucYmtDVmT1GDG3",
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': "Xn16rfdygfViHe2u36jkDUs9NLmUrUsEKa"}
                });
              case "lastseen":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': 1502078120,
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': 1502078203}
                });
              case "activeseconds":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': 7016289,
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': 2871829}
                });
                break;
              case "addr":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': "108.61.209.47:9999",
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': "34.226.228.73:9999"}
                });
              case "status":
                return cb(null, { result:
                  { '06c4c53b64019a021e8597c19e40807038cab4cd422ca9241db82aa19887354b-0': "ENABLED",
                    'b76bafae974b80204e79858eb62aedec41159519c90d23f811cca1eca40f2e4c-1': "ENABLED"}
                });
            }
          }
        }
      });

      sparksd.getMNList(function(err, MNList) {
        err.should.be.instanceof(Error);
        done();
      });
    });
  });

  describe('#generateBlock', function() {
    it('will give rpc error', function(done) {
      var sparksd = new sparksService(baseConfig);
      var generate = sinon.stub().callsArgWith(1, {message: 'error', code: -1});
      sparksd.nodes.push({
        client: {
          generate: generate
        }
      });
      sparksd.generateBlock(10, function(err) {
        should.exist(err);
        err.should.be.an.instanceof(errors.RPCError);
        done();
      });
    });
    it('will call client generate and give result', function(done) {
      var sparksd = new sparksService(baseConfig);
      var generate = sinon.stub().callsArgWith(1, null, {
        result: ['hash']
      });
      sparksd.nodes.push({
        client: {
          generate: generate
        }
      });
      sparksd.generateBlock(10, function(err, hashes) {
        if (err) {
          return done(err);
        }
        hashes.length.should.equal(1);
        hashes[0].should.equal('hash');
        done();
      });
    });
  });

  describe('#stop', function() {
    it('will callback if spawn is not set', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.stop(done);
    });
    it('will exit spawned process', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.spawn = {};
      sparksd.spawn.process = new EventEmitter();
      sparksd.spawn.process.kill = sinon.stub();
      sparksd.stop(done);
      sparksd.spawn.process.kill.callCount.should.equal(1);
      sparksd.spawn.process.kill.args[0][0].should.equal('SIGINT');
      sparksd.spawn.process.emit('exit', 0);
    });
    it('will give error with non-zero exit status code', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.spawn = {};
      sparksd.spawn.process = new EventEmitter();
      sparksd.spawn.process.kill = sinon.stub();
      sparksd.stop(function(err) {
        err.should.be.instanceof(Error);
        err.code.should.equal(1);
        done();
      });
      sparksd.spawn.process.kill.callCount.should.equal(1);
      sparksd.spawn.process.kill.args[0][0].should.equal('SIGINT');
      sparksd.spawn.process.emit('exit', 1);
    });
    it('will stop after timeout', function(done) {
      var sparksd = new sparksService(baseConfig);
      sparksd.shutdownTimeout = 300;
      sparksd.spawn = {};
      sparksd.spawn.process = new EventEmitter();
      sparksd.spawn.process.kill = sinon.stub();
      sparksd.stop(function(err) {
        err.should.be.instanceof(Error);
        done();
      });
      sparksd.spawn.process.kill.callCount.should.equal(1);
      sparksd.spawn.process.kill.args[0][0].should.equal('SIGINT');
    });
  });

});