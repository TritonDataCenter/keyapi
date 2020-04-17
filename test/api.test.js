/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright 2020 Joyent, Inc.
 */

/*
 * These tests assume that they're operating with a clean database -- no entries
 * for KEYAPI_DN. If you're not running these tests in production (don't!), then
 * use 'sdc-ldap s' and 'sdc-ldap del' to clean out any extraneous entries.
 */

var assert = require('assert-plus');
var test = require('tap').test;
var Bunyan = require('bunyan');
var Keyapi = require('../');
var UFDS = require('ufds');


assert.string(process.env.UFDS_IP, 'UFDS_IP envvar');
assert.string(process.env.UFDS_LDAP_ROOT_PASSWORD,
    'UFDS_LDAP_ROOT_PASSWORD envvar');

var UFDS_URL = 'ldaps://' + process.env.UFDS_IP;
var UFDS_PASSWORD = process.env.UFDS_LDAP_ROOT_PASSWORD


var KEYAPI_DN = 'ou=keyapiprivkeys, o=smartdc';

var keys = [ {
    uuid: '8ea74e99-91d5-4207-9822-7096900b44c5',
    key: '499d7d5db79b25d9be22197d869b38bb8b2dbb5e86ba3565b4fbd542e1b1bd33',
    timestamp: '2014-03-25T10:47:19.342Z',
    objectclass: 'keyapiprivkey'
}, {
    uuid: '2022a43b-1699-46e9-9233-517a4dbeffd8',
    key: '647e49528b7e046c703c150295eb0f3643c0d42e62e91484df67892a9613e5d6',
    timestamp: '2014-03-26T10:52:52.381Z',
    objectclass: 'keyapiprivkey'
} ];

var testObj = {
    foo: 'bar',
    baz: [1, 2, 3],
    quux: true
};

var bunyan = new Bunyan({ name: 'test' });

var ufdsOptions = {
    url: UFDS_URL,
    bindDN: 'cn=root',
    bindPassword: UFDS_PASSWORD,
    log: bunyan
};

var ufds;
var keyapi;



test('load test keys into UFDS, initialized keyapi', function (t) {
    ufds = new UFDS(ufdsOptions);

    ufds.on('connect', function () {
        var dn = 'dn=' + keys[0].uuid + ', ' + KEYAPI_DN;
        ufds.add(dn, keys[0], function (err) {
            t.ifError(err);

            dn = 'dn=' + keys[1].uuid + ', ' + KEYAPI_DN;
            ufds.add(dn, keys[1], function (err2) {
                t.ifError(err2);

                keyapi = new Keyapi({ log: bunyan, ufds: ufdsOptions });

                t.end();
            });
        });
    });
});



test('token/detoken round-trip (with stubs)', checkRoundTrip);
test('token/detoken round-trip (without stubs)', checkRoundTrip);



function checkRoundTrip(t) {
    keyapi.token(testObj, function (err, token) {
        t.ifError(err);

        t.equal(token.keyid, keys[1].uuid);
        t.equal(token.version, '0.1.0');
        t.ok(typeof (token.data) === 'string');
        t.ok(typeof (token.hash) === 'string');

        keyapi.detoken(token, function (err2, newObj) {
            t.ifError(err2);
            t.equivalent(testObj, newObj);
            t.end();
        });
    });
}



test('will only tokenize objects', function (t) {
    var json = JSON.stringify(testObj);

    keyapi.token(json, function (err, token) {
        t.equal(err, 'Data to tokenize is not an object');
        t.ifError(token);
        t.end();
    });
});



test('token/detoken round-trip (without superfluous JSON)', function (t) {
    var json = JSON.stringify(testObj);

    // bypass the public function since it will prevent this abuse
    keyapi.tokenizer.encrypt(json, function (err, token) {
        t.ifError(err);

        t.equal(token.keyid, keys[1].uuid);
        t.equal(token.version, '0.1.0');
        t.ok(typeof (token.data) === 'string');
        t.ok(typeof (token.hash) === 'string');

        var jsonToken = JSON.stringify(token);

        keyapi.detoken(jsonToken, function (err2, newObj) {
            t.ifError(err2);
            t.equivalent(testObj, newObj);
            t.end();
        });
    });
});



test('clear test keys from UFDS', function (t) {
    var dn = 'dn=' + keys[0].uuid + ', ' + KEYAPI_DN;
    ufds.del(dn, function (err) {
        t.ifError(err);

        dn = 'dn=' + keys[1].uuid + ', ' + KEYAPI_DN;
        ufds.del(dn, function (err2) {
            t.ifError(err2);
            t.end();
        });
    });
});



test('keyapi should save new key to UFDS if there was none', function (t) {
    var keyapi2 = new Keyapi({ log: bunyan, ufds: ufdsOptions });

    var opts = {
        scope: 'sub',
        filter: '(objectclass=keyapiprivkey)'
    };

    setTimeout(function () {
        ufds.search(KEYAPI_DN, opts, function (err, entries) {
            t.ifError(err);

            var keyUuid = keyapi2.tokenizer.encryptionKey.uuid;
            t.equal(entries[0].uuid, keyUuid);

            var dn = 'dn=' + keyUuid + ', ' + KEYAPI_DN;
            ufds.del(dn, function (err2) {
                t.ifError(err2);

                ufds.close(function () {
                    t.end();
                });
            });
        });
    }, 1000);
});
