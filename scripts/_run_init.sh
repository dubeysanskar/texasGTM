#!/bin/bash
cd /var/www/texasgtm
export $(cat .env | xargs)
node -e 'require("./src/lib/db").initSchema().then(()=>{console.log("OK");process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})'
