const PairedBluetoothDevices = {};

export const requestDeviceAsync = async (query, serviceId) => {
    log(query);

    const objquery = JSON.parse(query);
    const device = await navigator.bluetooth.requestDevice(objquery);
    const isSuccess = await connectAsync(device, serviceId);

    if (isSuccess) {
        PairedBluetoothDevices[device.id] = device;
        return { "Name": device.name, "Id": device.id };
    } else {
        return null;
    }
}

export const setObjectReference = (deviceId, objectReference) => {
    const device = getDevice(deviceId);
    device.ObjectReference = objectReference;
}

export const readValueAsync = async (deviceId, serviceId, characteristicId) => {
    const device = getDevice(deviceId);

    if (device.gatt.connected) {
        try {
            const service = await device.gatt.getPrimaryService(serviceId);
            const characteristic = await service.getCharacteristic(characteristicId);

            const value = await characteristic.readValue();
            const uint8Array = new Uint8Array(value.buffer);
            const array = Array.from(uint8Array);
            return array;
        } catch (error) {
            console.error(error);
            console.error(error.stack);
            return null;
        }
    } else {
        // 再接続
        const isSuccess = await connectAsync(device, serviceId);
        if (isSuccess) {
            return await readValueAsync(deviceId, serviceId, characteristicId);
        }
        return null;
    }
}

export const writeValueAsync = async (deviceId, serviceId, characteristicId, value) => {
    const device = getDevice(deviceId);

    if (device.gatt.connected) {
        try {
            const service = await device.gatt.getPrimaryService(serviceId);
            const characteristic = await service.getCharacteristic(characteristicId);
            const bytes = Uint8Array.from(value);
            await characteristic.writeValueWithoutResponse(bytes);
        } catch (error) {
            console.error(error);
            console.error(error.stack);
        }
    } else {
        // 再接続
        const isSuccess = await connectAsync(device, serviceId);
        if (isSuccess) {
            return await writeValueAsync(deviceId, serviceId, characteristicId, value);
        }
    }
}

export const onDisconnectedAsync = async arg => {
    log('> Bluetooth Device disconnected');
    console.log(arg);
    console.log(arg.srcElement);

    const device = getDevice(arg.srcElement.id);
    device.removeEventListener('gattserverdisconnected', onDisconnectedAsync);

    delete PairedBluetoothDevices[arg.srcElement.id];

    // C#側に通知
    if (device.objectReference) {
        await device.objectReference.invokeMethodAsync('HandleDisconnectedEvent');
    }
}

const connectAsync = async (device, serviceId) => {
    try {
        log('Connecting to Bluetooth Device... ');
        await device.gatt.connect();
        log('> Connected: ');
        console.log(device);
        log('> Getting primary service..');
        const service = await device.gatt.getPrimaryService(serviceId);
        log('> Service found.');
        return true;
    } catch (error) {
        console.error(error);
        console.error(error.stack);
        if (error.name == 'NotFoundError') {
            log('> Service not found.');
            disconnect();
            return false;
        } else if (error.name == 'NetworkError') {
            // ServiceID取得中に接続が切れた場合は再接続
            return await connectAsync(device, serviceId);
        }
    }
}

const disconnect = device => {
    if (device.gatt.conncted) {
        device.gatt.disconnect();
    }
}

const log = text => console.log('[' + new Date().toJSON().substring(11, 20) + '] ' + text);

const getDevice = deviceId => PairedBluetoothDevices[deviceId];

