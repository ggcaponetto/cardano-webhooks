# A Cardano Webhook Runner for the 141x Platform

## Usage

1. Create a keypair on [https://141x-testnet.io/settings](https://141x-testnet.io/settings) or [https://141x.io/settings](https://141x.io/settings)
1. Export the keys as file
1. Create some webhooks on [https://141x-testnet.io/](https://141x-testnet.io/) or [https://141x.io/](https://141x.io/)
1. Download the configuration
1. Run ``141x-runner-windows-x64.exe --testnet --private-key .\141x-key.private --config .\141x-webhooks-config.json``

## Build
1. ``npm i``
1. ``npm run build``

### Node.js
1. ``node src/index.js --testnet --private-key ./141x-key.private --config ./141x-webhooks-config.json``

### Windows x64
1. ``141x-runner-windows-x64.exe --testnet --private-key .\141x-key.private --config .\141x-webhooks-config.json``

## Tests
1. ``npm run test``

## Usage

This client receives from the 141x server updates on a 2 seconds interval at latest containing
the latest updates to the Cardano blockchain. If there are updates avaiable within those 2 seconds
intervals an update event will also be fired. This app is currently faster than the official
 [cardano explorer](https://explorer.cardano.org/en).

All updates can be accessed by the statment``let updates = ctx.util.updates;``.
This object looks represents the updated tables of cardano-db-sync. You can build
your webhook logic based on that.

````json
[
        {
            "meta": {
                "error": false
            },
            "table": "block",
            "row": {
                "id": 2890034,
                "hash": "\\x2a698a016b9d11678b4355d414207c685a06a1e0e0be5e6554e03ff1af112521",
                "epoch_no": 154,
                "slot_no": 36560611,
                "epoch_slot_no": 402211,
                "block_no": 2889824,
                "previous_id": 2890033,
                "slot_leader_id": 2126848,
                "size": 889,
                "time": "2021-09-06T12:03:47",
                "tx_count": 3,
                "proto_major": 5,
                "proto_minor": 0,
                "vrf_key": "vrf_vk1e9cl5kk6jxf7m0zd8thf0ww39qtpyyww7d85avq3zzf757fymtsst0wtus",
                "op_cert": "\\xffc0a966c24bf9e8f5d7739cfe4c4512ecb59a713785ec1c2efd40d6eefe1a68",
                "op_cert_counter": 5
            }
        },
        {
            "meta": {
                "error": false
            },
            "table": "tx",
            "row": {
                "id": 620368,
                "hash": "\\x17aeb1c269ce947ce49b208891cfa45e3daa51b26927946ce3bd28bfe99f194e",
                "block_id": 2890034,
                "block_index": 0,
                "out_sum": 9272852984036,
                "fee": 169021,
                "deposit": 0,
                "size": 297,
                "invalid_before": null,
                "invalid_hereafter": 36567763,
                "valid_contract": true,
                "script_size": 0
            }
        },
        {
            "meta": {
                "error": false
            },
            "table": "tx_out",
            "row": {
                "id": 1742783,
                "tx_id": 620368,
                "index": 0,
                "address": "addr_test1qrylaznlyclaw5s9asxkvsaq5lfxfuhggredz75h8jqt3kap04uyju69a0wxlps2yzfl9hpyrgrata6qddw3dhygzadqdlmrz8",
                "address_raw": "\\x00c9fe8a7f263fd75205ec0d6643a0a7d264f2e840f2d17a973c80b8dba17d78497345ebdc6f860a2093f2dc241a07d5f7406b5d16dc88175a",
                "payment_cred": "\\xc9fe8a7f263fd75205ec0d6643a0a7d264f2e840f2d17a973c80b8db",
                "stake_address_id": 42867,
                "value": 1000000000,
                "address_has_script": false,
                "data_hash": null
            }
        },
        {
            "meta": {
                "error": false
            },
            "table": "tx_in",
            "row": {
                "id": 1432177,
                "tx_in_id": 620368,
                "tx_out_id": 620345,
                "tx_out_index": 1,
                "redeemer_id": null
            }
        }
    ]
````
The updates array is *limited to 5 elements* in the demo version. To unlock the full
version you need to:

1. Create a keypair on [https://141x-testnet.io/settings](https://141x-testnet.io/settings) or [https://141x.io/settings](https://141x.io/settings)
1. Export the keys as file and store them somewhere safe
1. Create a transaction that contains the public key as metadata using the converter
on [https://141x-testnet.io/wallet](https://141x-testnet.io/wallet)
1. Submit the transaction with any amount of ADA using the official cardano-cli or if you trust me using
 my [141x - Wallet](https://141x-testnet.io/wallet). The address you need to pay is specified on
   [https://141x-testnet.io/settings](https://141x-testnet.io/settings).
1. After your public key gets written to the blockchain you will get lifetime unlimited access
the the updates, *no longer capped at 5 elements per update# 

You will get update notification from the tables: ``block``, ``tx``, ``tx_in``, ``tx_out``, ``tx_metadata``, ``tx``.

