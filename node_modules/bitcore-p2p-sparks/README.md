sparkscore P2P
=======

[![NPM Package](https://img.shields.io/npm/v/bitcore-p2p-sparks.svg?style=flat-square)](https://www.npmjs.org/package/bitcore-p2p-sparks)
[![Build Status](https://img.shields.io/travis/sparkscore-p2p.svg?branch=master&style=flat-square)](https://travis-ci.org/sparkscore-p2p)
[![Coverage Status](https://img.shields.io/coveralls/sparkscore-p2p.svg?style=flat-square)](https://coveralls.io/r/sparkscore-p2p?branch=master)

`sparkscore-p2p` adds sparks protocol support for sparkscore.

See [the main sparkscore repo](https://github.com/m0r4k/sparkscore) for more information.

## Getting Started

```sh
npm install bitcore-p2p-sparks
```
In order to connect to the sparks network, you'll need to know the IP address of at least one node of the network, or use [Pool](/docs/pool.md) to discover peers using a DNS seed.

```javascript
var Peer = require('bitcore-p2p-sparks').Peer;

var peer = new Peer({host: '127.0.0.1'});

peer.on('ready', function() {
  // peer info
  console.log(peer.version, peer.subversion, peer.bestHeight);
});
peer.on('disconnect', function() {
  console.log('connection closed');
});
peer.connect();
```

Then, you can get information from other peers by using:

```javascript
// handle events
peer.on('inv', function(message) {
  // message.inventory[]
});
peer.on('tx', function(message) {
  // message.transaction
});
```

Take a look at the [bitcore guide](http://bitcore.io/guide/peer.html) on the usage of the `Peer` class.

## Contributing

See [CONTRIBUTING.md](https://github.com/m0r4k/sparkscore/blob/master/CONTRIBUTING.md) on the main sparkscore repo for information about how to contribute.

## License

Code released under [the MIT license](https://github.com/dachevo/sparkscore/blob/master/LICENSE).

Copyright 2013-2015 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.
