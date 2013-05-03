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


var CHANGELOG = 'cn=changelog';
var KEYAPIPRIVKEY_DN = 'ou=keyapiprivkeys, o=smartdc';

function keycache(options) {
  assert.ok(options.ufds);

  var self = this;

  self.keys = {};
  self.latestkey = undefined;

  // populate keys
  self.ufds = new sdc.UFDS(options.ufds);
  self.ufds.on('ready', function() {
  var opts = {
    scope: "sub",
    filter: "(objectclass=keyapiprivkey)"
  };
  self.ufds.search("ou=keyapiprivkeys, o=smartdc", opts, function(err, entries) {
      if (err)
        throw err;
      for (var i = 0; i < entries.length; i++) {
        self.keys[entries[i].uuid] = entries[i];
      }
      self.getLatest();
    });

  /*
   * poll needs lower-level access to UFDS, not the convenience
   * functions of sdc-clients
   */
    self.ldapClient = ldap.createClient(options.ufds);
    self.pollinterval = options.pollInterval;
    self.changenumber = 0;
    self.timeout = options.ufds.timeout || self.pollinterval / 2;
 
    self.poll(self);
  });
};

module.exports.keycache = keycache;

function getLatest() {
  var self = this;
  var latest = self.latestkey ? self.latestkey : self.keys[Object.keys(self.keys)[0]];

  if (!latest)
    return;

  var keys = Object.keys(self.keys);

  var latestdate = new Date(latest.timestamp);

  for (var i = 0; i < keys.length; i++) {
    var d = new Date(self.keys[keys[i]]['timestamp']);
    if (d > latestdate)
      latest = self.keys[keys[i]];
  }
  self.latestkey = latest;
};

keycache.prototype.getLatest = getLatest;

function poll(self) {
  //var log = self.log;
  if (self.currPolling) {
    //log.info('already polling, skipping currently scheduled poll request');
    return;
  }
  self.currPolling = true;
  var start = parseInt(self.changenumber);
  
  /* JSSTYLED */
  var filter = sprintf('(&(changenumber>=%s)(targetdn=*ou=keyapiprivkeys*))', start);
  var opts = {
    scope: 'sub',
    filter: filter
  }

  var entries = [];
  var latestChangenumber = self.changenumber;
  var timeoutId = setTimeout(self.onTimeout, self.timeout);

  self.ldapClient.search(CHANGELOG, opts, function(err, res) {
    timeoutId._ldapRes = res;
    // return if unable to search ldap
    if (err) {
      clearTimeout(timeoutId);
      //log.error({err: err}, 'unable to search ldap, aborting poll');
      self.currPolling = false;
      return;
    }
    // save the matching entries and sort.
    res.on('searchEntry', function(entry) {
      clearTimeout(timeoutId);
      /*log.info({
        targetdn: entry.object.targetdn,
        changenumber: entry.object.changenumber,
        changetype: entry.object.changetype
      }, 'got search entry');*/

      // cache the cn if it's bigger, in case none of the entries match
      var changenumber = parseInt(entry.object.changenumber, 10);
      if (entry.object.changenumber > changenumber) {
        latestChangenumber = changenumber;
      }

      var targetdn = parseDN(entry.object.targetdn);
      var changes = JSON.parse(entry.object.changes);
      // dn has to match
      if (targetdn.childOf(KEYAPIPRIVKEY_DN)) {
        /*log.info({
                entryObject: entry.object
        }, 'dn matches');*/
        // object class has to match if exists
        var objectclass;
        if (changes && changes.objectclass) {
          objectclass = changes.objectclass[0];
          if (objectclass === 'keyapiprivkey') {
            entry.parsedChanges = changes;
            /*log.info({
              targetdn: targetdn,
              changenumber: entry.object.changenumber
            }, 'pushing entry');*/
            entries.push(entry);
          }
        }
      }
    });

    res.on('error', function(err) {
    });

    res.on('end', function(entries) {
      clearTimeout(timeoutId);
      //log.info('search ended sorting entries');
      if (entries.length === 0) {
        //log.info('no new entries');
        if (self.changenumber < latestChangenumber) {
          self.changenumber = latestChangenumber + 1;
          //log.info('updating cn to %s', self.changenumber);
        }
      }
      self.currPolling = false;
      /*entries.sort();

      entries.forEach(function(entry, index) {
        /*log.info({
          changenumber: entry.object.changenumber,
          changes: entry.object.changes
        }, 'entry changes');* /
        try {
          entry.self = self;
          self.queue.push(entry);
        } catch (e) {
          //log.error({err: err});
          throw e;
        }

        if (index === entries.length - 1) {
          //log.info('finished pushing changelogs up to %s', self.changenumber);
          self.currPolling = false;
        }
      }); */
    });

  });
  
};

keycache.prototype.poll = poll;

function onTimeout() {
  var self = this;
  self.currPolling = false;
};

keycache.prototype.onTimeout = onTimeout;
function parseEntry(entry, cb) {
  var self = entry.self;
  //var log = self.log;
  var changetype = entry.object.changetype;

  var changenumber = entry.object.changenumber;
  //log.info('parsing entry', changenumber);
  switch (changetype) {
  case 'add':
    add(self, entry.parsedChanges, entry);
    break;
  case 'delete':
    del(self, entry.parsedChanges, entry);
    break;
  default:
    throw new Error('default case invoked.');
  }

  // update to changenumber + 1 since the filter is >=changenumber
  // thankyou LDAP spec!
  self.changenumber = parseInt(entry.object.changenumber, 10) + 1;
}

function add(self, changes, entry) {
  if (changes.objectclass[0] != 'keyapiprivkey')
    throw new Error('somehow trying to add a non privkey');
  var dn = entry.object.targetdn; 
  var keyUUID = dn.split(',')[0].trim();
  self.keys.append(entry.object.changes);
  sortKeys(self);
  self.currentkey = self.keys[self.keys.length];
  return;
}

//function delete(self, changes, entry) {
//}

