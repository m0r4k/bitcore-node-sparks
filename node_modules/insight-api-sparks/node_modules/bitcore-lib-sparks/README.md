sparkscore Library
================

[![NPM Package](https://img.shields.io/npm/v/@sparksevo/sparkscore-lib.svg?style=flat-square)](https://www.npmjs.org/package/@sparksevo/sparkscore-lib)
[![Build Status](https://img.shields.io/travis/sparksevo/sparkscore-lib.svg?branch=master&style=flat-square)](https://travis-ci.org/sparksevo/sparkscore-lib)
[![Coverage Status](https://img.shields.io/coveralls/sparksevo/sparkscore-lib.svg?style=flat-square)](https://coveralls.io/github/sparksevo/sparkscore-lib?branch=master)

A pure and powerful JavaScript sparks library.

## Principles

sparks is a powerful new peer-to-peer platform for the next generation of financial technology. The decentralized nature of the sparks network allows for highly resilient sparks infrastructure, and the developer community needs reliable, open-source tools to implement sparks apps and services.

## Get Started
### NodeJS
```
npm install @sparksevo/sparkscore-lib
```

### Browser

See the section below to generate your own bundle, or download the pre-generated [minified file](dist/sparkscore-lib.min.js)


## Docs

* [Addresses](docs/address.md)
* [Block](docs/block.md)
* [Crypto](docs/crypto.md)
* [Encoding](docs/encoding.md)
* [Hierarchically-derived Private and Public Keys](docs/hierarchical.md)
* [Networks](docs/networks.md)
* [PrivateKey](docs/privatekey.md)
* [PublicKey](docs/publickey.md)
* [Script](docs/script.md)
* [Transaction](docs/transaction.md)
* [Using Different Units](docs/unit.md)
* [Unspent Output](docs/unspentoutput.md)
* [URI](docs/uri.md)
* [Governance Object / Proposal](docs/govobject/govobject.md)

## Examples

Some examples can be found [here](docs/examples.md), below is a list of direct links for some of them.


* [Generate a random address](docs/examples.md#generate-a-random-address)
* [Generate an address from a SHA256 hash](docs/examples.md#generate-a-address-from-a-sha256-hash)
* [Import an address via WIF](docs/examples.md#import-an-address-via-wif)
* [Create a Transaction](docs/examples.md#create-a-transaction)
* [Sign a sparks message](docs/examples.md#sign-a-bitcoin-message)
* [Verify a sparks message](docs/examples.md#verify-a-bitcoin-message)
* [Create an OP RETURN transaction](docs/examples.md#create-an-op-return-transaction)
* [Create a 2-of-3 multisig P2SH address](docs/examples.md#create-a-2-of-3-multisig-p2sh-address)
* [Spend from a 2-of-2 multisig P2SH address](docs/examples.md#spend-from-a-2-of-2-multisig-p2sh-address)

## Modules

Some functionality is implemented as a module that can be installed separately:

* [Payment Protocol Support](https://github.com/sparksevo/sparkscore-payment-protocol)
* [Peer to Peer Networking](https://github.com/sparksevo/sparkscore-p2p)
* [sparks Core JSON-RPC](https://github.com/sparksevo/sparksd-rpc)
* [Payment Channels](https://github.com/sparksevo/sparkscore-channel)
* [Mnemonics](https://github.com/sparksevo/sparkscore-mnemonic)
* [Elliptical Curve Integrated Encryption Scheme](https://github.com/sparksevo/bitcore-ecies-sparks)
* [Signed Messages](https://github.com/sparksevo/bitcore-message-sparks)

## Contributing

Please send pull requests for bug fixes, code optimization, and ideas for improvement. For more information on how to contribute, please refer to our [CONTRIBUTING](https://github.com/sparksevo/sparkscore-lib/blob/master/CONTRIBUTING.md) file.

## Building the Browser Bundle

To build a sparkscore-lib full bundle for the browser:

```sh
npm run build
```

This will generate files named `sparkscore-lib.js` and `sparkscore-lib.min.js` in the `dist/` folder.

## Usage on Browser

```
<script src='./dist/sparkscore-lib.min.js' type="text/javascript"></script>
<script>
  const PrivateKey = sparkscore.PrivateKey;
  const privateKey = new PrivateKey();
  const address = privateKey.toAddress().toString();
</script>
```

## Development & Tests

```sh
git clone https://github.com/sparksevo/sparkscore-lib
cd sparkscore-lib
npm install
```

Run all the tests:

```sh
npm test
```

You can also run just the Node.js tests with `npm run test:node`, just the browser tests with `npm run test:browser`
or run a test coverage report with `npm run coverage`.

## License

Code released under [the MIT license](LICENSE).

Copyright 2013-2017 BitPay, Inc. Bitcore is a trademark maintained by BitPay, Inc.  
Copyright 2016-2017 The sparks Foundation, Inc.  
Copyright 2017-2018 sparks Core Group, Inc.  
