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

log.setLevel('debug');

const socketIoServers = {
  mainnet: 'https://gateway.141x.io:443',
  testnet: 'https://gateway.141x-testnet.io:443',
};

function loadFile(filePath) {
  try {
    let absoluteFilePath = null;
    if (path.isAbsolute(filePath)) {
      absoluteFilePath = path.resolve(filePath);
    } else {
      absoluteFilePath = path.resolve(filePath);
    }
    const data = fs.readFileSync(absoluteFilePath, 'utf8');
    console.log(`loaded ${path}.`, data);
    return data;
  } catch (e) {
    console.log('error:', e);
    return null;
  }
}

function getJsEncrypt(privateKey) {
  const jsEncrypt = new JSEncrypt();
  jsEncrypt.setPrivateKey(privateKey);
  return jsEncrypt;
}
function emitPublicKey(socket, privateKey) {
  socket.emit('keys', {
    public: privateKey,
  });
}

function parseBufferMessage(args, jsEncrypt) {
  const {
    encryptedAesKey,
    ciphertext,
    payments,
  } = args[0];

  const decryptedAesKey = jsEncrypt.decrypt(encryptedAesKey);

  // Decrypt
  const bytes = CryptoJS.AES.decrypt(ciphertext, decryptedAesKey);
  const cleartext = bytes.toString(CryptoJS.enc.Utf8);
  const messages = JSON.parse(cleartext);
  return {
    messages,
    payments,
  };
}

function parsePaymentsMessage(args, jsEncrypt) {
  const {
    payments,
  } = args[0];
  return {
    payments,
  };
}

async function executeWebhooks(webhooksFileContent, myMessages) {
  const webhooks = JSON.parse(webhooksFileContent).rows;
  const executions = [];
  for (let i = 0; i < webhooks.length; i++) {
    const webhook = webhooks[i].doc;
    log.debug(`running webhook "${webhook.name}"`, webhook);
    const util = {
      toast: (myMessage, toastOptions) => {
        log.log(myMessage, toastOptions);
      },
      updates: myMessages,
      axios,
    };
    const ctx = { webhook, util };
    if (!webhook.active) return null;
    try {
      // eslint-disable-next-line no-new-func,no-undef
      const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
      const runnerFunction = new AsyncFunction('ctx', `"use strict"; ${webhook.script}`);
      const res = await runnerFunction(ctx);
      executions.push({ success: true, res, error: null });
    } catch (e) {
      log.error(e.message, e);
      executions.push({ success: false, res: null, error: e });
    }
  }
  return executions;
}

function run(argv) {
  const getConnectionString = () => {
    if (argv.mainnet) {
      return socketIoServers.mainnet;
    } if (argv.testnet) {
      return socketIoServers.testnet;
    }
    return socketIoServers.testnet;
  };
  const socket = io(getConnectionString());
  // client-side
  socket.on('connect', () => {
    log.log(socket.id); // x8WIv7-mJelg7on_ALbx
  });
  socket.on('disconnect', () => {
    log.log(socket.id); // undefined
  });
  return socket;
}
function disconnect(socket) {
  socket.disconnect();
}

function main(argv) {
  const socket = run(argv);
  if (!argv.mainnet && !argv.testnet) {
    throw Error('please provide a --testnet or --mainnet argument');
  }
  if (!argv['private-key']) {
    throw Error('please provide a --private-key argument');
  }
  if (!argv.config) {
    throw Error('please provide a --config argument');
  }
  const privateKey = loadFile(argv['private-key']);
  const webhookFileContent = loadFile(argv.config);
  const jsEncrypt = getJsEncrypt(privateKey);
  const onMessage = async (event, ...args) => {
    console.log(`Got "${event}" from ${socket.io.uri}`, {
      args,
    });
    if (event === 'payments') {
      // eslint-disable-next-line max-len
      const { payments } = parsePaymentsMessage(args, jsEncrypt);
      // eslint-disable-next-line max-len
      console.log(`Got "${event}" from ${socket.io.uri}`, {
        payments,
      });
    } else if (event === 'buffer') {
      const { messages, payments } = parseBufferMessage(args, jsEncrypt);
      console.log(`Got "${event}" from ${socket.io.uri}`, {
        payments, messages,
      });
      if (payments.length > 0 && messages.length > 0) {
        const executions = await executeWebhooks(webhookFileContent, messages);
        console.log('executed webhooks', {
          executions,
        });
      }
    }
  };
  socket.onAny(onMessage);
  emitPublicKey(socket, jsEncrypt.getPublicKey());
}

module.exports = {
  loadFile,
  run,
  emitPublicKey,
  getJsEncrypt,
  parseBufferMessage,
  parsePaymentsMessage,
  executeWebhooks,
  main,
};
