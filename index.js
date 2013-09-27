/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 *
 * Main entry-point for the Key API lib
 */

var crypt = require('./lib/crypt');
var kc = require('./lib/keycache');

function KeyAPI(opts) {
  assert.ok(options.log);
  assert.ok(options.ufds);
  this.log = options.log.child({'component': 'keyapi'});
  this.keycache = new kc.keycache(Config, this.log.child({'component': 'keycache'}));
  this.tokenizer = new crypt({keycache: keycache, log: this.log.child({'component': 'crypt'})}); 

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
