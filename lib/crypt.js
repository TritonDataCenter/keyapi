/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 *
 */


var crypto = require('crypto');
var zlib = require('zlib');
var fs = require('fs');
var assert = require('assert');

var APIVERSION = '0.1.0';

function tokenizer(options) {
    var self = this;

    assert.ok(options.keycache);
    assert.ok(options.log);

    self.keycache = options.keycache;
    self.log = options.log; 
}

module.exports = tokenizer;

tokenizer.prototype.decrypt = function (input, key) {
    var decipher = crypto.createDecipher('aes128', key);
    var decrypted = decipher.update(input, 'binary', 'binary');
    decrypted += decipher.final();
    return (decrypted);
};

tokenizer.prototype.crypt = function (input, key) {
    var cipher = crypto.createCipher('aes128', key);
    var crypted = cipher.update(input, 'binary', 'binary');
    crypted += cipher.final();
    return (crypted);
};


tokenizer.prototype.genCryptToken = function (gzdata, key) {
    var self = this;

    var tokdata = {
        date: new Date().toISOString(),
        data: gzdata
    };

    var cryptdata = self.crypt(JSON.stringify(tokdata), key);
    var tokstring = new Buffer(cryptdata, 'binary').toString('base64');
    return (tokstring);
};

tokenizer.prototype.tokenize = function (data, cb) {
    var self = this;
    var stringdata = JSON.stringify(data);
    self.log.trace({data: data}, 'creating token');

    var latestkey = self.keycache.latest;
    var key = new Buffer(latestkey.key, 'hex').toString('binary');

    zlib.gzip(stringdata, function (err, res) {
        if (!err) {
            var tokdata = self.genCryptToken(res.toString('binary'), key);

            var hasher = crypto.createHmac('sha256', key);
            hasher.update(tokdata);
            var hash = hasher.digest('base64');

            var token = {
                keyid: latestkey.uuid,
                data: tokdata,
                version: APIVERSION,
                hash: hash
            };
            self.log.trace({token: token}, 'created token');
            cb(token, undefined);
        } else {
            self.log.error('could not compress data: %s', err);
            cb(undefined, err);
        }
    });
};

tokenizer.prototype.detokenize = function (token, cb) {
    var self = this;
    self.log.trace({token: token}, 'cracking token');

    if (!token.keyid || !token.data || !token.hash || !token.version) {
        self.log.error('received invalid token', {token: token});
        cb(undefined, 'Not a valid token');
        return;
    }

    if (!self.keycache.keys[token.keyid]) {
        self.log.error({token: token}, 'received token with unknown keyid %s',
            token.keyid);
        cb(undefined, 'Unknown KeyID');
        return;
    }

    var keybuf = new Buffer(self.keycache.keys[token.keyid].key, 'hex');
    var key = keybuf.toString('binary');

    var hasher = crypto.createHmac('sha256', key);
    hasher.update(token.data);
    var hash = hasher.digest('base64');

    if (hash !== token.hash) {
        self.log.error({token: token}, 'received token with invalid hash');
        cb(undefined, 'Warning: corrupted token or malicious user');
        return;
    }

    var data = new Buffer(token.data, 'base64').toString('binary');
    var decryptData = JSON.parse(self.decrypt(data, key)).data;
    zlib.gunzip(new Buffer(decryptData, 'binary'), function (err, res) {
        if (err)
            self.log.error({token: token, decrypted_token: decryptData},
              'could not uncompress token');
        cb(JSON.parse(res.toString()));
     });
};
