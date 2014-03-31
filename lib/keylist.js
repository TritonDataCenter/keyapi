/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 *
 * Key list object
 */

var sdc = require('sdc-clients');
var util = require('util');
var assert = require('assert-plus');
var retry = require('retry');

var KEYAPIPRIVKEY_DN = 'ou=keyapiprivkeys, o=smartdc';


function Keylist(options, log) {
    assert.ok(options.ufds);
    assert.ok(options.log);

    var self = this;
    self.keys = [];
    self.latestkey = undefined;
    self.log = log;
    self.ufds = options.ufds;
}

module.exports = Keylist;


/*
 * Load all keyapi keys from UFDS and store them in object, then find the newest
 * key.
 */

Keylist.prototype.init = function (cb) {
    var self = this;

    var ufds = new sdc.UFDS(self.ufds);

    ufds.on('connect', function () {
        self.log.debug('connected to UFDS');

        var opts = {
            scope: 'sub',
            filter: '(objectclass=keyapiprivkey)'
        };

        var operation = retry.operation();
        operation.attempt(function (currentAttempt) {
            ufds.search(KEYAPIPRIVKEY_DN, opts, function (err, entries) {
                if (operation.retry(err)) {
                    self.log.error('could not search UFDS for keys, retrying');
                    return;
                }

                self.log.debug('found %s new keys', entries.length);

                self.keys = self.keys.concat(entries);

                ufds.close(function () {
                    self._getLatest();
                    cb();
                });
            });
        });
    });
};


Keylist.prototype._getLatest = function () {
    var self = this;

    var latest = self.keys[0];

    for (var i = 0; i < self.keys.length; i++) {
        var key = self.keys[i];
        var latestDate = new Date(latest.timestamp);
        var indexDate = new Date(key.timestamp);

        if (indexDate > latestDate)
            latest = key;
    }

    if (self.latest !== latest)
        self.log.debug('new latest key: %s', latest.uuid);

    self.latestkey = latest;

    return self;
};
