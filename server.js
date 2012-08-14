/*
 * Copyright (c) 2012, Joyent, Inc. All rights reserved.
 *
 * Main entry-point for the Clortho API.
 */

var restify = require('restify');
var Logger = require('bunyan');
var crypt = require('./lib/index')

var log = new Logger({
    name: 'clortho',
    level: 'debug',
    serializers: {
        err: Logger.stdSerializers.err,
        req: Logger.stdSerializers.req,
        res: restify.bunyan.serializers.response
    }
});



var server = restify.createServer({
    name: 'Clortho',
    log: log
});

var tokenizer = new crypt({keyfile:"keyfile", "latestkey": "latest"});

server.use(restify.bodyParser({ mapParams: false }));

server.post({path: '/detoken', name: 'detokenize'}, function(req, res, next) {
	var tok =  req.body;

	tokenizer.detokenize(tok, function(obj, err) {
		if (obj) {
			res.send(200, obj)
		  return next();
		} else {
			res.send(500, JSON.stringify(err));
			return next();

		}
	});
	
});

server.post({path: '/token', name: 'tokenize'}, function(req, res, next) {
	var obj = req.body;
	tokenizer.tokenize(obj, function(tok, err) {
		if (tok) {
			res.send(200, tok);
			return next();
		} else {
			res.send(500, JSON.stringify(err));
			return next();
		}
	});
});


server.listen(8080, function () {
    log.info({url: server.url}, '%s listening', server.name);
});
