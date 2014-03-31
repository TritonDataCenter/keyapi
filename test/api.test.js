/*
 * Copyright (c) 2014, Joyent, Inc. All rights reserved.
 */

var test = require('tap').test;
var Bunyan = require('bunyan');
var Keyapi = require('../');
var UFDS = require('sdc-clients').UFDS;



var UFDS_URL = 'ldaps://' + (process.env.UFDS_IP || '10.99.99.18');
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

var ufds;
var keyapi;



test('load test keys into UFDS, initialized keyapi', function (t) {
    var bunyan = new Bunyan({ name: 'test' });

    var ufdsOptions = {
        url: UFDS_URL,
        bindDN: 'cn=root',
        bindPassword: 'secret',
        log: bunyan
    };

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

            ufds.close(function () {
                t.end();
            });
        });
    });
});
