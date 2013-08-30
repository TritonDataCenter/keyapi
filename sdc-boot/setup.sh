#!/usr/bin/bash
#
# Copyright (c) 2013 Joyent Inc., All rights reserved.
#

export PS4='[\D{%FT%TZ}] ${BASH_SOURCE}:${LINENO}: ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
set -o xtrace

PATH=/opt/local/bin:/opt/local/sbin:/usr/bin:/usr/sbin

role=keyapi
app_name=$role

# SAPI manifests
CONFIG_AGENT_LOCAL_MANIFESTS_DIRS=/opt/smartdc/keyapi

# Include common utility functions (then run the boilerplate)
source /opt/smartdc/sdc-boot/scripts/util.sh
sdc_common_setup

# Cookie to identify this as a SmartDC zone and its role
mkdir -p /var/smartdc/keyapi

# Install KeyAPI
mkdir -p /opt/smartdc/keyapi
chown -R nobody:nobody /opt/smartdc/keyapi

# Add build/node/bin and node_modules/.bin to PATH
echo "" >>/root/.profile
echo "export PATH=\$PATH:/opt/smartdc/keyapi/build/node/bin:/opt/smartdc/keyapi/node_modules/.bin" >>/root/.profile

# All done, run boilerplate end-of-setup
sdc_setup_complete

exit 0
