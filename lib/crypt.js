/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 *
 */ 


var crypto = require('crypto');
var zlib = require('zlib');
var fs = require('fs');
var assert = require('assert');

var APIVERSION = 0.1.0

function tokenizer(options) {
  var self = this;

  assert.ok(options.keycache);

  self.keycache = options.keycache;

};

module.exports = tokenizer;

tokenizer.prototype.decrypt = function(input, key) {
  var self = this;
  var decipher = crypto.createDecipher('aes128', key);
  var decrypted = decipher.update(input, 'binary', 'binary')
  decrypted += decipher.final();
  return (decrypted);
}

tokenizer.prototype.crypt = function(input, key) {
  var self = this;
  
  var cipher = crypto.createCipher("aes128", key);
  var crypted = cipher.update(input, 'binary', 'binary');
  crypted += cipher.final()
  return (crypted);
};


tokenizer.prototype.genCryptToken = function(gzdata, key) {
  var self = this;

  var tokdata = {
    date: new Date().toISOString(),
    data: gzdata,
  }
  var cryptdata = self.crypt(JSON.stringify(tokdata), key);
  var tokstring = new Buffer(cryptdata, 'binary').toString('base64');
  return (tokstring);
}

tokenizer.prototype.tokenize = function( data, cb ) {
  var self = this;
  var stringdata = JSON.stringify(data);

  var latestkey = self.keycache.latest;
  var key = new Buffer(latestkey.key, 'hex').toString('binary');

  zlib.gzip(stringdata, function(err, res) {
    if (!err) {
      var tokdata = self.genCryptToken(res.toString('binary'), key);
  
      var hash = crypto.createHmac('sha256', key).update(tokdata).digest('base64');

      var token = {
        keyid: latestkey.uuid,
        data: tokdata,
        version: APIVERSION,
        hash: hash
      }

      cb(token, undefined);
    } else {
      cb(undefined, err);
    }
  });
}

tokenizer.prototype.detokenize = function(token, cb) {
  var self = this;
  if (!token.keyid || !token.data || !token.hash || !token.version) {
    cb(undefined, "Not a valid token");
    return;
  }

  if (!self.keycache.keys[token.keyid]) {
    cb(undefined, "Unknown KeyID");
    return;
  }

  var key = new Buffer(self.keycache.keys[token.keyid].key, 'hex').toString('binary');

  var hash = crypto.createHmac('sha256', key).update(token.data).digest('base64');
  if(hash !== token.hash) {
    cb(undefined, "Warning: corrupted token or malicious user");
    return;
  }

  var data = new Buffer(token.data, 'base64').toString('binary');
  var decryptData = JSON.parse(self.decrypt(data, key)).data;
  zlib.gunzip(new Buffer(decryptData, 'binary'), function(err, res ) {
    cb(JSON.parse(res.toString()))
   });
}
