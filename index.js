/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 *
 * Main entry-point for the Key API lib
 */

var crypt = require('./lib/crypt');
var kc = require('./lib/keycache');
var assert = require('assert-plus')
var Logger = require('bunyan');

function KeyAPI(options) {
  if (! options.log )
    options.log = new Logger({
            name: 'keyapi',
            level: 'debug',
            serializers: {
                    err: Logger.stdSerializers.err,
                    req: Logger.stdSerializers.req
            }
  }); 
  //assert.ok(options.ufds);
  this.log = options.log.child({'component': 'keyapi'});
  this.keycache = new kc.keycache(options, this.log.child({'component': 'keycache'}));
  this.tokenizer = new crypt({keycache: this.keycache, log: this.log.child({'component': 'crypt'})}); 

}
module.exports = KeyAPI;

KeyAPI.prototype.detoken = function(token) {
  var self = this;
  (self.tokenizer.detokenize(token, function(obj, err) {
    cb(obj, err);
  }));
};

KeyAPI.prototype.token = function(obj) {
  self.tokenizer.tokenize(obj, function(tok, err) {
    cb(tok, err);
  });
};
