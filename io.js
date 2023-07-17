"use strict";

class MemoryIO {
    constructor(address) {
        this._base_address = address;
        this._buffer = new ArrayBuffer(4);
        this._view = new DataView(this._buffer);
        this._array = new Uint8Array(this._buffer);
        this._encoder = new TextEncoder("utf-8");
        this._decoder = new TextDecoder("utf-8");
    }

    store_direct(data) {
        new Uint8Array(this._buffer).set(new Uint8Array(data));
    }

    get_start_address() {
        return this._base_address;
    }

    get_end_address() {
        return this._base_address;
    }

    check_address(address) {
        return (address === this._base_address);
    }

    load(address, size) {
        return 0;
    }

    store(address, size, value) {
        switch(size) {
            case 8:
                this._view.setUint8(0, value);
                process.stdout.write(this._decoder.decode(this._array.slice(0,1)));
                break;
            case 16:
                this._view.setUint16(0, value, true);
                process.stdout.write(this._decoder.decode(this._array.slice(0,2)));
                break;
            case 32:
                this._view.setUint32(0, value, true);
                process.stdout.write(this._decoder.decode(this._array));
                break;
            default:
                throw new Error("IO store size invalid");
        }
    }
}

module.exports = MemoryIO;
