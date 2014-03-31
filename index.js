/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 *
 * Main entry-point for the Key API lib.
 *
 * Keyapi
 * Keyapi loads keyapi-specific keys from UFDS; the newest key is used for all
 * future tokens, while other keys are used to decode older tokens. Keyapi is
 * then used to generate secure tokens, or validate and decode old tokens.
 *
 * The current design is a bit odd (using and replacing stubs) to maintain
 * backwards-compatibility with previous versions of keyapi. The constructor
 * returns immediately, and there is no init() method, so there's no sane means
 * of waiting until the keys in UFDS have been loaded, so the delay is added
 * in thes stubs.
 */

var Keylist = require('./lib/keylist');
var SecureToken = require('sdc-securetoken');



function KeyAPI(options) {
    var self = this;

    self.log = options.log.child({ component: 'keyapi' });

    var keylistLog = self.log.child({ component: 'keylist' });
    var keylist = new Keylist(options, keylistLog);

    keylist.init(function () {
        self.tokenizer = new SecureToken(keylist.latestkey, keylist.keys);
    });
}

module.exports = KeyAPI;



/*
 * Take a token and return the private data contained inside if it's valid.
 */

KeyAPI.prototype._detoken = function (token, cb) {
    var self = this;

    deJson(token, function (err, token2) {
        if (err)
            return cb(err);

        return self.tokenizer.decrypt(token2, function (err2, data) {
            if (err2)
                return cb(err2);

            // unfortunately, some old tokens may be JSON'd JSON, so we need to
            // do this to be safe with old tokens
            return deJson(data, cb);
        });
    });
};



/*
 * Take private data and encrypt it into a HMAC'd token.
 */

KeyAPI.prototype._token = function (obj, cb) {
    if (typeof (obj) !== 'object')
        return cb('Data to tokenize is not an object');

    return this.tokenizer.encrypt(obj, cb);
};



/*
 * Stub to give UFDS a chance to return keys. Once self.tokenizer is available,
 * replace stub with the real thing (_detoken above).
 */

KeyAPI.prototype.detoken = function (token, cb) {
    var self = this;

    if (self.tokenizer) {
        self._detoken(token, cb);
        self.detoken = self._detoken;
    } else {
        setTimeout(function () {
            self._detoken(token, cb);
        }, 1000);
    }
};



/*
 * Stub to give UFDS a chance to return keys. Once self.tokenizer is available,
 * replace stub with the real thing (_token above).
 */

KeyAPI.prototype.token = function (obj, cb) {
    var self = this;

    if (self.tokenizer) {
        self._token(obj, cb);
        self.token = self._token;
    } else {
        setTimeout(function () {
            self._token(obj, cb);
        }, 1000);
    }
};



function deJson(data, cb) {
    if (typeof (data) === 'string') {
        try {
            data = JSON.parse(data);
        } catch (e) {
            return cb('unable to deserialize JSON');
        }
    }

    return cb(null, data);
}