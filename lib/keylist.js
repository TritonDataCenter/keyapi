/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 *
 * Load all keyapi keys from UFDS. If there are no keys (when it's a brand new
 * DC) then insert a new generated key, then proceed as normal. We should also
 * find the newest key specifically so that all new tokens in index.js use the
 * newest key.
 */

var crypto = require('crypto');
var util = require('util');
var assert = require('assert-plus');
var retry = require('retry');
var uuid = require('node-uuid');
var sdc = require('sdc-clients');



var KEYAPIPRIVKEY_DN = 'ou=keyapiprivkeys, o=smartdc';



function Keylist(options, log) {
    assert.ok(options.ufds);
    assert.ok(options.log);

    this.keys = [];
    this.latestkey = null;
    this.log = log;
    this.ufds = options.ufds;
}

module.exports = Keylist;



/*
 * Load all keyapi keys from UFDS and store them in object, then find the newest
 * key. If this is a brand new DC, there will be no key, in which case keyapi
 * generates a new one.
 */

Keylist.prototype.init = function (cb) {
    var self = this;

    var ufds = new sdc.UFDS(self.ufds);

    var finish = function (entries) {
        self.keys = entries;
        self._loadLatest();
        ufds.close(cb);
    };

    ufds.once('connect', function () {
        self.log.debug('connected to UFDS');

        var opts = {
            scope: 'sub',
            filter: '(objectclass=keyapiprivkey)'
        };

        var operation = retry.operation();
        operation.attempt(function (currentAttempt) {
            ufds.search(KEYAPIPRIVKEY_DN, opts, function (err, entries) {
                if (operation.retry(err)) {
                    self.log.debug(err);
                    self.log.error('could not search UFDS for keys, retrying');
                    return null;
                }

                self.log.debug('found %s new keys', entries.length);

                // almost always we'll find keys, and return here
                if (entries.length > 0)
                    return finish(entries);

                // but for the very first time, we need to save a new one
                var key = generateNewKey();
                var dn = 'dn=' + key.uuid + ', ou=keyapiprivkeys, o=smartdc';

                return ufds.add(dn, key, function (err2) {
                    assert.ifError(err2);

                    finish([key]);
                });
            });
        });
    });
};



/*
 * Find the most recent key (by date), and load it into an attribute.
 */

Keylist.prototype._loadLatest = function () {
    var self = this;

    var latest = self.keys[0];

    for (var i = 0; i < self.keys.length; i++) {
        var key = self.keys[i];
        var latestDate = new Date(latest.timestamp);
        var indexDate = new Date(key.timestamp);

        if (indexDate > latestDate)
            latest = key;
    }

    if (!self.latestkey || self.latestkey.uuid !== latest.uuid)
        self.log.debug('new latest key: %s', latest.uuid);

    self.latestkey = latest;
};



/*
 * Return a new key (UUID and key value).
 */

function generateNewKey() {
    var id   = uuid();
    var hex  = crypto.randomBytes(32).toString('hex');
    var date = new Date().toISOString();

    var ufdsEntry = {
       uuid: id,
       key: hex,
       timestamp: date,
       objectclass: 'keyapiprivkey'
    };

    return ufdsEntry;
}
