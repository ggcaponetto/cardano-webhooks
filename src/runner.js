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

const SOCKETIO_MAINNET = process.env.SOCKETIO_MAINNET || (() => {
  const host = 'https://gateway.141x.io:443';
  console.info(`no SOCKETIO_MAINNET found. Using default: ${host}`);
  return host;
})();
const SOCKETIO_TESTNET = process.env.SOCKETIO_TESTNET || (() => {
  const host = 'https://gateway.141x-testnet.io:443';
  console.info(`no SOCKETIO_TESTNET found. Using default: ${host}`);
  return host;
})();
const SOCKETIO_ALT = process.env.SOCKETIO_ALT || (() => {
  const host = 'http://localhost:5003';
  console.info(`no SOCKETIO_TESTNET found. Using default: ${host}`);
  return host;
})();

const socketIoServers = {
  mainnet: SOCKETIO_MAINNET,
  testnet: SOCKETIO_TESTNET,
  alt: SOCKETIO_ALT,
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
    // console.log(`loaded file ${path}.`);
    return data;
  } catch (e) {
    console.log('error loading file:', e);
    return null;
  }
}

function getJsEncrypt(privateKey) {
  const jsEncrypt = new JSEncrypt();
  jsEncrypt.setPrivateKey(privateKey);
  return jsEncrypt;
}
function emitPublicKey(socket, publicKey, network) {
  log.debug('client is emitting public key', { publicKey, network });
  socket.emit('keys', {
    public: publicKey,
    network,
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
  log.debug(`running ${webhooks.length} webhooks`);
  for (let i = 0; i < webhooks.length; i += 1) {
    const webhook = webhooks[i];
    log.debug(`running webhook "${webhook.doc.name}"`, webhook);
    const util = {
      toast: (myMessage, toastOptions) => {
        log.log(myMessage, toastOptions);
      },
      updates: myMessages,
      axios,
    };
    const ctx = { webhook, util };
    if (!webhook.doc.active) return null;
    try {
      // eslint-disable-next-line no-new-func,no-undef
      const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
      globalThis.ctx = ctx;
      const runnerFunction = new AsyncFunction(`"use strict"; ${webhook.doc.script};`);
      const res = await runnerFunction().catch((e) => {
        console.error(`error in runnerFunction (${webhook.doc.name})`, e);
        throw e;
      });
      delete globalThis.ctx;
      executions.push({ success: true, returnValue: res, error: null });
    } catch (e) {
      log.error(e.message, e);
      executions.push({ success: false, returnValue: null, error: e });
    }
  }
  const successCount = executions.filter((ex) => ex.success).length;
  const failureCount = executions.filter((ex) => !ex.success).length;
  console.error(`run all webhooks. ${successCount} succeeded, ${failureCount} failed.`);
  return executions;
}

async function run(argv) {
  const getConnectionString = () => {
    if (argv.mainnet) {
      return socketIoServers.mainnet;
    } if (argv.testnet) {
      return socketIoServers.testnet;
    } if (argv.alt) {
      return socketIoServers.alt;
    }
    return socketIoServers.testnet;
  };
  return new Promise((res) => {
    const connectionString = getConnectionString();
    log.log('connecting to ', connectionString); // x8WIv7-mJelg7on_ALbx
    const socket = io(connectionString);
    // client-side
    socket.on('connect', () => {
      log.log('connect event fired', socket.id); // x8WIv7-mJelg7on_ALbx
      res(socket);
    });
    socket.on('disconnect', () => {
      log.log('disconnect event fired', socket.id); // undefined
    });
  });
}
function disconnect(socket) {
  socket.disconnect();
}

async function main(argv) {
  const socket = await run(argv);
  if (!argv.mainnet && !argv.testnet && !argv.alt) {
    throw Error('please provide a --testnet, --mainnet or --alt argument');
  }
  if (!argv['private-key']) {
    throw Error('please provide a --private-key argument');
  }
  if (!argv.config) {
    throw Error('please provide a --config argument');
  }
  const privateKey = loadFile(argv['private-key']);
  log.log('loaded private key', argv['private-key']);
  const webhookFileContent = loadFile(argv.config);
  log.log('loaded webhook config', argv.config);
  const jsEncrypt = getJsEncrypt(privateKey);
  const onMessage = async (event, ...args) => {
    console.log(`Got "${event}" from ${socket.io.uri}`, {
      args,
    });
    if (event === 'payments') {
      // eslint-disable-next-line max-len
      const { payments } = parsePaymentsMessage(args, jsEncrypt);
    } else if (event === 'buffer') {
      const { messages, payments } = parseBufferMessage(args, jsEncrypt);
      if (payments.length > 0 && messages.length > 0) {
        const executions = await executeWebhooks(webhookFileContent, messages);
        console.log('executed webhooks', {
          executions,
        });
      }
    }
  };
  socket.onAny(onMessage);
  const network = argv.mainnet ? 'mainnet' : 'testnet';
  emitPublicKey(socket, jsEncrypt.getPublicKey(), network);
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
