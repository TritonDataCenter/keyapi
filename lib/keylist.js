/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 *
 * Key list object
 */

var sdc = require('sdc-clients');
var util = require('util');
var assert = require('assert-plus');

var KEYAPIPRIVKEY_DN = 'ou=keyapiprivkeys, o=smartdc';

function keylist(options, log) {
    assert.ok(options.ufds);
    var self = this;

    self.keys = {};
    self.latestkey = undefined;
    self.log = log;

    var ufds = new sdc.UFDS(options.ufds);
    ufds.on('connect', function () {
        self.log && self.log.debug("connected to UFDS");
        var opts = {
            scope: 'sub',
            filter: '(objectclass=keyapiprivkey)'
        };
        ufds.search(KEYAPIPRIVKEY_DN, opts, function (err, entries) {
            if (err) {
                self.log && self.log.fatal("could not search UFDS for private keys, exiting");
                throw err;
            }
            self.log && self.log.debug('found %s new keys', entries.length);
            for (var i = 0; i < entries.length; i++) {
                self.keys[entries[i].uuid] = entries[i];
            }
            ufds.close(function () {
                return self.getLatest();
            });
        });
    });
}

module.exports.keylist = keylist;

function getLatest() {
    var self = this;
    var idx = Object.keys(self.keys);
    var latest = self.keys[idx[0]];
    for (var i = 0; i < idx.length; i++) {
        var latestDate = new Date(latest.timestamp);
        var indexDate = new Date(self.keys[idx[i]].timestamp);
        if (indexDate > latestDate)
            latest = self.keys[idx[i]];
    }
    if (self.latest !== latest)
        self.log.debug('new latest key: %s', latest.uuid);

    self.latestkey = latest;
    return self;
}

keylist.prototype.getLatest = getLatest;
