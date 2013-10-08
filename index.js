/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 *
 * Main entry-point for the Key API lib
 */

var crypt = require('./lib/crypt');
var kl = require('./lib/keylist');
var assert = require('assert-plus')
var Logger = require('bunyan');

function KeyAPI(options) {
  if (! options.log )
    options.log = new Logger({
            name: 'keyapi',
            level: 'info',
            serializers: {
                    err: Logger.stdSerializers.err,
                    req: Logger.stdSerializers.req
            }
  }); 
  //assert.ok(options.ufds);
  this.log = options.log.child({'component': 'keyapi'});
  this.keylist = new kl.keylist(options, this.log.child({'component': 'keylist'}));
  this.tokenizer = new crypt({keycache: this.keylist, log: this.log.child({'component': 'crypt'})}); 

}

KeyAPI.prototype.detoken = function(token, cb) {
  var self = this;
  (self.tokenizer.detokenize(token, function(obj, err) {
    if (obj && typeof(obj) == 'string')
      obj = JSON.parse(obj);
    cb(obj, err);
  }));
};

KeyAPI.prototype.token = function(obj, cb) {
  var self = this;
  obj = JSON.stringify(obj);
  self.tokenizer.tokenize(obj, function(tok, err) {
    cb(tok, err);
  });
};

module.exports = KeyAPI;
