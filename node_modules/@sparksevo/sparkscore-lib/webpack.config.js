const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

const commonJSConfig = {
  entry: ['./index.js'],
  module: {
    rules: [],
  },
  target: 'web'
};

const rawConfig = Object.assign({}, commonJSConfig, {
  output: {
    path: path.resolve(__dirname, '.'),
    filename: 'sparkscore-lib.js',
    library: 'sparkscore',
    libraryTarget: 'umd',
  }
})
const uglifiedConfig = Object.assign({}, commonJSConfig, {
  output: {
    path: path.resolve(__dirname, '.'),
    filename: 'sparkscore-lib.min.js',
    library: 'sparkscore',
    libraryTarget: 'umd',
  },
  plugins: [
    new UglifyJsPlugin()
  ]
})

module.exports = [rawConfig, uglifiedConfig];