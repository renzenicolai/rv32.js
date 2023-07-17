"use strict";

class Bus {
    constructor() {
        this._peripherals = [];
    }

    add_peripheral(peripheral) {
        this._peripherals.push(peripheral);
    }

    get_peripheral(address) {
        for (let index = 0; index < this._peripherals.length; index++) {
            let peripheral = this._peripherals[index];
            if (peripheral.check_address(address)) {
                return peripheral;
            }
        }
        return null;
    }

    load(address, size) {
        let peripheral = this.get_peripheral(address);
        if (peripheral !== null) {
            return peripheral.load(address, size);
        }
        throw new Error("Unmapped load address " + address.toString(16));
    }

    store(address, size, value) {
        let peripheral = this.get_peripheral(address);
        if (peripheral !== null) {
            return peripheral.store(address, size, value);
        }
        throw new Error("Unmapped store address " + address.toString(16));
    }
}

module.exports = Bus;
