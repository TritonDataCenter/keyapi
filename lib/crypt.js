/*
 * Copyright (c) 2012, Joyent, Inc. All rights reserved.
 *
 * Vinz Clortho - the keymaster. SSO/auth token server. 
 */ 


var crypto = require('crypto');
var zlib = require('zlib');
var fs = require('fs');
var assert = require('assert');


function tokenizer(options) {
  var self = this;

  assert.ok((options.key && options.keyversion && options.keyid) ||
      options.keyfile, "Need to pass key or keyfile");

  if (options.key)
    var rawKey = options.key;
  else if ( options.keyfile ) {
    var keys = JSON.parse(fs.readFileSync(options.keyfile));
    var rawKey = keys.keys[keys.latest]

  }

  self.key = new Buffer(rawKey, 'hex').toString('binary');

};

module.exports = tokenizer;

tokenizer.prototype.decrypt = function(input) {
  var self = this;
  var decipher = crypto.createDecipher('aes128', self.key);
  var decrypted = decipher.update(input, 'binary', 'binary')
  decrypted += decipher.final();
  return (decrypted);
}

tokenizer.prototype.crypt = function(input) {
  var self = this;
  var cipher = crypto.createCipher("aes128", self.key);
  var crypted = cipher.update(input, 'binary', 'binary');
  crypted += cipher.final()
  return (crypted);
};


tokenizer.prototype.genCryptToken = function(gzdata) {
  var self = this;
  var tokdata = {
    date: new Date().toISOString(),
    data: gzdata,
  }

  var cryptdata = self.crypt( JSON.stringify(tokdata) );
  var tokstring = new Buffer(cryptdata, 'binary').toString('base64');
  return (tokstring);
}

tokenizer.prototype.tokenize = function( data, cb ) {
  var self = this;
  var stringdata = JSON.stringify(data);
  zlib.gzip(stringdata, function(err, res) {
    if (!err) {
      var tokdata = self.genCryptToken(res.toString('binary'));
  
      var hash = crypto.createHmac('sha256', self.key).update(tokdata).digest('base64');

      var token = {
        keyid: self.keyid,
        keyversion: self.keyversion,
        data: tokdata,
        hash: hash
      }

      cb(token, undefined);
    } else {
      cb(undefined, err);
    }
  });
}

tokenizer.prototype.detokenize = function(token, cb)  {
  var self = this;
  var hash = crypto.createHmac('sha256', self.key).update(token.data).digest('base64');
  assert.equal( hash, token.hash, "Warning: corrupted token or malicious user" );

  var data = new Buffer(token.data, 'base64').toString('binary');
  var decryptData = JSON.parse(self.decrypt(data)).data;
  zlib.gunzip(new Buffer(decryptData, 'binary'), function(err, res ) {
    cb(JSON.parse(res.toString()))
   });
}
