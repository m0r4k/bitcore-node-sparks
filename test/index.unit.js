'use strict';

var should = require('chai').should();

describe('Index Exports', function() {
  it('will export bitcore-lib-sparks', function() {
    var sparkscore = require('../');
    should.exist(sparkscore.lib);
    should.exist(sparkscore.lib.Transaction);
    should.exist(sparkscore.lib.Block);
  });
});
