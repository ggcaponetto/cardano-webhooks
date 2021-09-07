#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env-runner') });
const log = require('loglevel');
const chalk = require('chalk');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const io = require('socket.io-client');
const CryptoJS = require('crypto-js');
const axios = require('axios');

global.navigator = { appName: 'nodejs' }; // fake the navigator object
global.window = {};
const JSEncrypt = require('jsencrypt/bin/jsencrypt');
const packageJson = require('../package.json');

const { argv } = yargs(hideBin(process.argv));
const { main } = require('./runner');

log.setLevel('debug');
log.debug(chalk.green(`Starting the 141x runner (version ${packageJson.version}).\n`, JSON.stringify(argv)));
main(argv);
