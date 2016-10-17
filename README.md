<!--
    This Source Code Form is subject to the terms of the Mozilla Public
    License, v. 2.0. If a copy of the MPL was not distributed with this
    file, You can obtain one at http://mozilla.org/MPL/2.0/.
-->

<!--
    Copyright (c) 2014, Joyent, Inc.
-->

# keyapi

This repository is part of the Joyent Triton project. See the [contribution
guidelines](https://github.com/joyent/triton/blob/master/CONTRIBUTING.md) --
*Triton does not use GitHub PRs* -- and general documentation at the main
[Triton project](https://github.com/joyent/triton) page.

KeyAPI is a simple library to create and unpackage opaque encrypted tokens
for services that require user authentication

KeyAPI provides a mechanism for Triton to securely pass information in and out
of the system using tokens.

# Using KeyAPI

## POST: /token

As "Content-Type: application/json", POST a json object to the /token endpoint

will return a tokenized json object with the "data" and "hash" fields set

## POST: /detoken

As "Content-Type: application/json", POST a token object to /detoken

returns a JSON object, the contents of the token
