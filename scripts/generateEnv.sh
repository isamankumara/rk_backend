#!/bin/sh
set -e

ENV=null
CONTEXT='backend';
while getopts e:c: OPTION; do
  case $OPTION in
    e)
      ENV=$OPTARG
      ;;
    c)
      CONTEXT=$OPTARG
      ;;
    ?)
    echo "Invalid Option"
    exit
    ;;
  esac
done


echo "====================================";
echo "$ENV.env for context $CONTEXT";
echo "====================================";

gcloud auth activate-service-account ${GOOGLE_SERVICE_ACCOUNT} --key-file=${GOOGLE_SECRETS_MANAGER_FILE_PATH} --project=alifelived
gcloud secrets list --filter="labels.context=backend" --format="value(name)" | \
xargs -I % /bin/bash -c \
'if [ $(echo % | cut -d"_" -f1) = "$0" ];  then 
echo "$(echo % | cut -d"_" -f2-)=$(gcloud secrets versions access latest --secret=%)" 
fi' $ENV > .env
