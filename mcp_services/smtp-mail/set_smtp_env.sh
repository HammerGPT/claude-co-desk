#!/bin/bash

# SMTP Configuration for smtp_mail MCP service
# This script sets environment variables for the SMTP service

export SMTP_HOST="smtp.example.com"
export SMTP_PORT="587"
export SMTP_USER="your_email@example.com"
export SMTP_PASS="your_password"
export SMTP_SECURE="false"

echo "SMTP environment variables set for smtp_mail MCP service:"
echo "SMTP_HOST: $SMTP_HOST"
echo "SMTP_PORT: $SMTP_PORT"
echo "SMTP_USER: $SMTP_USER"
echo "SMTP_PASS: [HIDDEN]"
echo "SMTP_SECURE: $SMTP_SECURE"