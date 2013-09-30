#!/usr/bin/bash
# -*- mode: shell-script; fill-column: 80; -*-
#
# Copyright (c) 2013 Joyent Inc., All rights reserved.
#

export PS4='[\D{%FT%TZ}] ${BASH_SOURCE}:${LINENO}: ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
set -o xtrace

PATH=/opt/local/bin:/opt/local/sbin:/usr/bin:/usr/sbin

echo "Creating KeyAPI encryption key"
rand=$(cat /dev/urandom | gtr -cd [:alnum:] | ghead -c ${1:-1024})
key=$(openssl enc -aes-128-cbc -P -k ${rand} | grep key | cut -f2 -d '=')
cat > /opt/smartdc/keyapi/keyfile <<DONE
{
  "latest" : 0,
  "keys" : [ "${key}" ]
}
DONE

echo "Updating SMF manifest"
$(/opt/local/bin/gsed -i"" -e "s/@@PREFIX@@/\/opt\/smartdc\/keyapi/g" /opt/smartdc/keyapi/smf/manifests/keyapi.xml)


echo "Importing keyapi.xml"
/usr/sbin/svccfg import /opt/smartdc/keyapi/smf/manifests/keyapi.xml

exit 0