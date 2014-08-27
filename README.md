<!--
    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
-->

<!--
    Copyright (c) 2014, Joyent, Inc.
-->

# KeyAPI

Repository: <git@github.com:joyent-smartdatacenter/keyapi.git>
Browsing: <https://mo.joyent.com/keyapi>
Who: John Sonnenschein
Docs: <https://mo.joyent.com/docs/keyapi>
Tickets/bugs: <https://devhub.joyent.com/jira/browse/TOOLS>


# Overview

KeyAPI provides a mechanism for SDC to securely pass information in and out
of the system 

# Repository

    deps/           Git submodules and/or commited 3rd-party deps should go
                    here. See "node_modules/" for node.js deps.
    docs/           Project docs (restdown)
    lib/            Source files.
    node_modules/   Node.js deps, either populated at build time or commited.
                    See Managing Dependencies.
    pkg/            Package lifecycle scripts
    smf/manifests   SMF manifests
    smf/methods     SMF method scripts
    test/           Test suite (using node-tap)
    tools/          Miscellaneous dev/upgrade/deployment tools and data.
    Makefile
    package.json    npm module info (holds the project version)
    README.md


# Development

To run the KeyAPI server:

    git clone git@github.com:joyent-smartdatacenter/keyapi.git
    cd keyapi
    git submodule update --init
    make all
    node server.js

To update the guidelines, edit "docs/index.restdown" and run `make docs`
to update "docs/index.html".

Before commiting/pushing run `make prepush` and, if possible, get a code
review.



# Testing

    make test

# Using KeyAPI

## POST: /token

As "Content-Type: application/json", POST a json object to the /token endpoint

will return a tokenized json object with the "data" and "hash" fields set

## POST: /detoken

As "Content-Type: application/json", POST a token object to /detoken

returns a JSON object, the contents of the token
