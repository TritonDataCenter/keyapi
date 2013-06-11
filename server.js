/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 *
 * Main entry-point for the Key API.
 */

var restify = require('restify');
var Logger = require('bunyan');
var async = require('async');
var child_process = require('child_process');
var fs = require('fs');

var crypt = require('./lib/crypt');
var kc = require('./lib/keycache');


function main() {
    var Config = JSON.parse(fs.readFileSync('/opt/smartdc/keyapi/config.json'));
    var keycache = new kc.keycache(Config);

    var tokenizer = new crypt({keycache: keycache});

    var log = new Logger({
            name: 'keyapi',
            level: 'debug',
            serializers: {
                    err: Logger.stdSerializers.err,
                    req: Logger.stdSerializers.req,
                    res: restify.bunyan.serializers.response
            }
    });


    var server = restify.createServer({
            name: 'KeyAPI',
            log: log
    });
    server.use(restify.bodyParser({ mapParams: false }));

    server.post({path: '/detoken', name: 'detokenize'},
        function (req, res, next) {
        var tok =    req.body;

        tokenizer.detokenize(tok, function (obj, err) {
            if (obj && !err) {
                res.send(200, obj);
                return next();
            } else {
                res.send(500, JSON.stringify(err));
                return next();

            }
        });

    });

    server.post({path: '/token', name: 'tokenize'}, function (req, res, next) {
        var obj = req.body;
        tokenizer.tokenize(obj, function (tok, err) {
            if (tok) {
                res.send(200, tok);
                return next();
            } else {
                res.send(500, JSON.stringify(err));
                return next();
            }
        });
    });


    server.listen(Config.port, function () {
            log.info({url: server.url}, '%s listening', server.name);
    });
}

main();
