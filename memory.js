"use strict";

class Memory {
    constructor(size, base_address) {
        this._size = size;
        this._base_address = base_address;
        this._buffer = new ArrayBuffer(size);
        this._view = new DataView(this._buffer);
    }

    store_direct(data) {
        new Uint8Array(this._buffer).set(new Uint8Array(data));
    }

    get_start_address() {
        return this._base_address;
    }

    get_end_address() {
        return this._base_address + this._size - 1;
    }

    check_address(address) {
        let position = address - this._base_address;
        return (position >= 0 && position < this._size);
    }

    load(address, size) {
        let position = address - this._base_address;
        if (position < 0 || position >= this._size) {
            throw new Error("Memory load address out of range");
        }
        switch(size) {
            case 8:
                return this._view.getUint8(position);
            case 16:
                return this._view.getUint16(position, true);
            case 32:
                return this._view.getUint32(position, true);
            default:
                throw new Error("Memory load size invalid");
        }
    }

    store(address, size, value) {
        let position = address - this._base_address;
        if (position < 0 || position >= this._size) {
            throw new Error("Memory store address out of range");
        }
        switch(size) {
            case 8:
                this._view.setUint8(position, value);
                break;
            case 16:
                this._view.setUint16(position, value, true);
                break;
            case 32:
                this._view.setUint32(position, value, true);
                break;
            default:
                throw new Error("Memory store size invalid");
        }
    }
}

module.exports = Memory;
