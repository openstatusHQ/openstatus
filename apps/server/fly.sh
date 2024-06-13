#!/bin/bash


fly machines list  --json | jq .[].id | sed 's/"//g' | while read machine; do
  fly machines update $machine --restart always --yes
done