/* eslint-env mocha */

const path = require('path');
const axios = require('axios');
const chai = require('chai');

describe('Test arguments of script', async (suite) => {
  it('should load the file of a given path (privateKey)', (done) => {
    // eslint-disable-next-line global-require
    const { loadFile } = require('../src/runner');
    const content = loadFile('../runner/test/files/141x-key.private');
    if (content) {
      chai.expect(content).to.equal(`-----BEGIN RSA PRIVATE KEY-----
MIICXAIBAAKBgQCsOKS4xr079NZxQva0eBOMNHlCpOPl1QUyWazh6Eaz1jqcLzo4
HV9pwqNqixSdWeCF8ueH+9dL4T9I2nZCfBC6ETcgOKQb+UDF+cuC0y0X68iVu6rf
VUnqhxEQMVpzhgNNP54oKhm7U1PVADFAoZ9vNwAXxygEV9F0pVAVSe+eEwIDAQAB
AoGANVJYVclan6yflHO6NIgU7Uz12ld5JBi/QiaXq14iPd3vSZopuWQGvZUAyaUE
He/M30wkuWqU7y5vTJwvD0igWKi2RTNcFY0siB7/vM95xZBJmlvSui+9gIO64WQx
8gv8Li27hlUJSWAYxvSGNyvm0aZFtHXlkj/E6vxzbRuOLpECQQDsoDhtvdDuB9FV
n1IkOs485/pyOzxTaPsZtw6Vpv/NNBjg+5SYlTsfYD9Mop9wWEU1O6qP2emhQaCS
5LM8agcrAkEAulJ5mvdWzJF4Am6HntpniGhjmuytli0VtxB9In2dW2T8GfrtsXEk
Wbkh10Wo+bCrGNnT1Js6DE0Nf06Cc7lQuQJAcRNno9mve/A0cuw9vp5za9uXbPst
qtZiGDnIOG+jkhYxRWIz8m5t4GKIHUEhW/hyqiunKDMEWFEaQNgVZutsHQJALoo/
WdgCVGLZqTHWqnU/ezEoACCyU1q7m9iAiUb7MUMOPacSDEqIm+jEbTM3O/dHJZPz
d522aDAu+OexahqV8QJBANGY9ir5XJ3x+hWq2WbPkjyOKXoiZxzupqKLTI8hfSzy
aDucXqBBYGLyfaXYQpqsdNB3CMU4wmZQepiEMQG1sws=
-----END RSA PRIVATE KEY-----
`);
      done();
    }
  });
  it('should load the file of a given path (collection)', (done) => {
    // eslint-disable-next-line global-require
    const { loadFile } = require('../src/runner');
    const content = loadFile('../runner/test/files/141x-webhooks-config.json');
    if (content) {
      const parsed = JSON.parse(content);
      chai.expect(typeof parsed).to.equal('object');
      done();
    }
  });
  it('should send the public key and receive encoded messages', function (done) {
    this.timeout(2 * 60 * 1000);
    const {
      loadFile, run, emitPublicKey, getJsEncrypt, parseBufferMessage, parsePaymentsMessage,
      executeWebhooks,
      // eslint-disable-next-line global-require
    } = require('../src/runner');
    const socket = run({ testnet: true, mainnet: false });
    const privateKey = loadFile('../runner/test/files/141x-key.private');
    const webhookFileContent = loadFile('../runner/test/files/141x-webhooks-config.json');
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
          chai.expect(
            executions.map((execution) => execution.success).every((element) => element === true),
          ).to.be(true);
          done();
        }
      }
    };
    socket.onAny(onMessage);
    emitPublicKey(socket, jsEncrypt.getPublicKey());
  });
  it('runs an async function', async function () {
    this.timeout(5 * 1000);
    const {
      loadFile,
      // eslint-disable-next-line global-require
    } = require('../src/runner');
    const webhookFileContent = loadFile('../runner/test/files/141x-webhooks-config.json');
    const collection = JSON.parse(webhookFileContent);
    const webhooks = collection.rows;
    // eslint-disable-next-line no-restricted-syntax
    for (const webhook of webhooks) {
      const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
      const util = {
        toast: (myMessage, toastOptions) => {
          console.log(myMessage, toastOptions);
        },
        updates: [],
        axios,
      };
      const ctx = { webhook, util };
      globalThis.ctx = ctx;
      console.debug(`running (${webhook.doc.name})`);
      const runnerFunction = new AsyncFunction(`"use strict"; ${webhook.doc.script};`);
      const res = await runnerFunction().catch((e) => {
        console.error(`error in runnerFunction (${webhook.doc.name})`, e);
        return e;
      });
      delete globalThis.ctx;
      if (res) {
        console.debug('response', res.data);
      }
    }
  });
});
