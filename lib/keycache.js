/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 *
 * Key cache / private key object
 */

var sdc = require('sdc-clients');
var ldap = require('ldapjs');
var parseDN = ldap.parseDN;
var util = require('util');
var assert = require('assert-plus');
var sprintf = require('sprintf').sprintf;
var vasync = require('vasync');
var crypto = require('crypto');

var CHANGELOG = 'cn=changelog';
var KEYAPIPRIVKEY_DN = 'ou=keyapiprivkeys, o=smartdc';

function keycache(options) {
    assert.ok(options.ufds);

    var self = this;

    self.keys = {};
    self.latestkey = undefined;

    // populate keys
    var ufds = new sdc.UFDS(options.ufds);
    ufds.on('ready', function () {
        var opts = {
            scope: 'sub',
            filter: '(objectclass=keyapiprivkey)'
        };
        ufds.search(KEYAPIPRIVKEY_DN, opts, function (err, entries) {
            if (err)
                throw err;
            for (var i = 0; i < entries.length; i++) {
                self.keys[entries[i].uuid] = entries[i];
            }
            if (entries.length === 0) {
                var key = require('crypto').randomBytes(32).toString('hex');
                var uuid = require('node-uuid')();
                var date = new Date().toISOString();
                var obj = {
                    uuid: uuid,
                    key: key,
                    timestamp: date,
                    objectclass: 'keyapiprivkey'
                };
                self.keys[uuid] = obj;
                var insertdn = 'uuid=' + uuid + ', ' + KEYAPIPRIVKEY_DN;
                ufds.add(insertdn, obj, function (err2) {
                    if (err2)
                        throw err2;
                    console.log('No key found, inserted ' + uuid);
                    // tear down the connection, we don't care anymore
                    ufds.client.removeAllListeners('close');
                    ufds.client.removeAllListeners('timeout');
                    ufds.close(function (err3) {
                        if (err3) {
                            console.log('Error closing the connection: ' + err3);
                            throw err3;
                        }
                    });
                });
            } else {
                // tear down the connection, we don't care anymore
                ufds.client.removeAllListeners('close');
                ufds.client.removeAllListeners('timeout');
                ufds.close(function (err3) {
                    if (err3) {
                        console.log('Error closing the connection: ' + err3);
                        throw err3;
                    }
                });
            }
            self.getLatest(self);

        });

      /*
       * poll needs lower-level access to UFDS, not the convenience
       * functions of sdc-clients
       */
        self.ldapClient = ldap.createClient(options.ufds);
        self.ldapClient.bind(options.ufds.bindDN, options.ufds.bindPassword,
            function (err) {
              if (err)
                  throw err;
        });
        self.pollInterval = options.pollInterval;
        self.changenumber = 0;
        self.timeout = options.ufds.timeout || self.pollInterval / 2;
        self.currPolling = false;

        setInterval(self.poll, self.pollInterval, self);
    });
}

module.exports.keycache = keycache;

function poll(self) {
    if (self.currPolling) {
        return;
    }
    self.currPolling = true;
    var start = parseInt(self.changenumber, 10);

    var latestchange = self.changenumber;

    /* JSSTYLED */
    var filter = sprintf('(&(changenumber>=%s)(targetdn=*ou=keyapiprivkeys*))', start);
    var opts = {
        scope: 'sub',
        filter: filter
    };
    var entries = [];
    var timeoutId = setTimeout(self.onTimeout, self.timeout);

    self.ldapClient.search(CHANGELOG, opts, function (err, res) {
        timeoutId._ldapRes = res;

        if (err) {
            clearTimeout(timeoutId);
            self.currPolling = false;
            return;
        }

        res.on('searchEntry', function (entry) {
            clearTimeout(timeoutId);

            var changenumber = parseInt(entry.object.changenumber, 10);
            if (changenumber > self.changenumber) {
                latestchange = changenumber;
            }

            var targetdn = parseDN(entry.object.targetdn);
            var changes = JSON.parse(entry.object.changes);

            if (targetdn.childOf(KEYAPIPRIVKEY_DN)) {
                if (changes && changes.objectclass) {
                    var objectclass = changes.objectclass[0];
                    if (objectclass == 'keyapiprivkey') {
                        entry.parsedChanges = changes;
                        entries.push(entry);
                    }
                }
            }

        });
        res.on('end', function (res2) {
            clearTimeout(timeoutId);
            if (entries.length === 0) {
                if (self.changenumber < latestchange)
                    self.changenumber = latestchange + 1;
                self.currPolling = false;
            }
            entries.forEach(function (entry, index) {
                var uuid = entry.parsedChanges.uuid[0];
                if (!uuid)
                    return;
                if (self.keys[uuid])
                    assert.ok(self.keys[uuid]['key'] ==
                        entry.parsedChanges.key[0]);

                    var obj = {
                        uuid: entry.parsedChanges.uuid[0],
                        key: entry.parsedChanges.key[0],
                        timestamp: new Date(entry.parsedChanges.timestamp[0])
                    };
                    self.keys[uuid] = obj;
                    console.log('New key: ' + uuid);
            });
        });
        res.on('error', function (err2) {
          // log the error, we'll pick it up next poll
          console.log('Search Error: ' + err2);
        });
    });

}

keycache.prototype.poll = poll;

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
    self.latest = latest;
}

keycache.prototype.getLatest = getLatest;
