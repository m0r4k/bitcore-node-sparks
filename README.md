Sparkscore Node
============

A Sparks full node for building applications and services with Node.js. A node is extensible and can be configured to run additional services. At the minimum a node has an interface to [Sparks Core (sparksd) v0.13.0](https://github.com/sparkspay/sparks/tree/v0.13.0.x) for more advanced address queries. Additional services can be enabled to make a node more useful such as exposing new APIs, running a block explorer and wallet service.

## Usages

### As a standalone server

```bash
git clone https://github.com/sparkspay/sparkscore-node
cd sparkscore-node
npm install
./bin/sparkscore-node start
```

When running the start command, it will seek for a .sparkscore folder with a sparkscore-node.json conf file.
If it doesn't exist, it will create it, with basic task to connect to sparksd.

Some plugins are available :

- Insight-API : `./bin/sparkscore-node addservice insight-api-sparks`
- Insight-UI : `./bin/sparkscore-node addservice insight-ui-sparks`

You also might want to add these index to your sparks.conf file :
```
-addressindex
-timestampindex
-spentindex
```

### As a library

```bash
npm install bitcore-node-sparks
```

```javascript
const sparkscore = require('bitcore-node-sparks');
const config = require('./sparkscore-node.json');

let node = sparkscore.scaffold.start({ path: "", config: config });
node.on('ready', function() {
    //Sparks core started
    sparksd.on('tx', function(txData) {
        let tx = new sparkscore.lib.Transaction(txData);
    });
});
```

## Prerequisites

- Sparks Core (sparksd) (v0.13.0) with support for additional indexing *(see above)*
- Node.js v8+
- ZeroMQ *(libzmq3-dev for Ubuntu/Debian or zeromq on OSX)*
- ~20GB of disk storage
- ~1GB of RAM

## Configuration

Sparkscore includes a Command Line Interface (CLI) for managing, configuring and interfacing with your Sparkscore Node.

```bash
sparkscore-node create -d <sparks-data-dir> mynode
cd mynode
sparkscore-node install <service>
sparkscore-node install https://github.com/yourname/helloworld
sparkscore-node start
```

This will create a directory with configuration files for your node and install the necessary dependencies.

Please note that [Sparks Core](https://github.com/sparkspay/sparks/tree/master) needs to be installed first.

For more information about (and developing) services, please see the [Service Documentation](docs/services.md).

## Add-on Services

There are several add-on services available to extend the functionality of Bitcore:

- [Insight API](https://github.com/sparkspay/insight-api-sparks/tree/master)
- [Insight UI](https://github.com/sparkspay/insight-ui-sparks/tree/master)
- [Bitcore Wallet Service](https://github.com/sparkspay/sparkscore-wallet-service/tree/master)

## Documentation

- [Upgrade Notes](docs/upgrade.md)
- [Services](docs/services.md)
  - [Sparksd](docs/services/sparksd.md) - Interface to Sparks Core
  - [Web](docs/services/web.md) - Creates an express application over which services can expose their web/API content
- [Development Environment](docs/development.md) - Guide for setting up a development environment
- [Node](docs/node.md) - Details on the node constructor
- [Bus](docs/bus.md) - Overview of the event bus constructor
- [Release Process](docs/release.md) - Information about verifying a release and the release process.


## Setting up dev environment (with Insight)

Prerequisite : Having a sparksd node already runing `sparksd --daemon`.

Sparkscore-node : `git clone https://github.com/sparkspay/sparkscore-node -b develop`
Insight-api (optional) : `git clone https://github.com/sparkspay/insight-api-sparks -b develop`
Insight-UI (optional) : `git clone https://github.com/sparkspay/insight-ui-sparks -b develop`

Install them :
```
cd sparkscore-node && npm install \
 && cd ../insight-ui-sparks && npm install \
 && cd ../insight-api-sparks && npm install && cd ..
```

Symbolic linking in parent folder :
```
npm link ../insight-api-sparks
npm link ../insight-ui-sparks
```

Start with `./bin/sparkscore-node start` to first generate a ~/.sparkscore/sparkscore-node.json file.
Append this file with `"insight-ui-sparks"` and `"insight-api-sparks"` in the services array.

## Contributing

Please send pull requests for bug fixes, code optimization, and ideas for improvement. For more information on how to contribute, please refer to our [CONTRIBUTING](https://github.com/sparkspay/sparkscore/blob/master/CONTRIBUTING.md) file.

## License

Code released under [the MIT license](https://github.com/sparkspay/sparkscore-node/blob/master/LICENSE).

Copyright 2016-2018 Sparks Core Group, Inc.

- bitcoin: Copyright (c) 2009-2015 Bitcoin Core Developers (MIT License)
