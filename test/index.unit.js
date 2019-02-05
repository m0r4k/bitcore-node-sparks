'use strict';

var should = require('chai').should();

describe('Index Exports', function() {
  it('will export sparkscore-lib', function() {
    var sparkscore = require('../');
    should.exist(sparkscore.lib);
    should.exist(sparkscore.lib.Transaction);
    should.exist(sparkscore.lib.Block);
  });
});
