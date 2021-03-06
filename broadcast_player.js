/**
 * Created by SazzSomewhere on 29.10.13.
 */
var events = require('events');
var iceStreamerModule = require('./icestreamer');
var util = require('util');
var dgram = require('dgram');

var BroadcastPlayer = function(broadcastIP, broadcastPort) {
    this.currentChannelUrl = '';
    this.currentChannelId = 0;
    this.broadcastIP = broadcastIP;
    this.broadcastPort = broadcastPort;
    this.iceStreamer = new iceStreamerModule.IceStreamer();
    var self = this;
    this.iceStreamer.on("trackInfo", function(data) {
        self.onTrackInfo(data);
    });
    this.iceStreamer.on("streamClosed", function(data) {
        self.onStreamClosed(data);
    });
    this.iceStreamer.on("streamReady", function(data) {
        self.onStreamReady(data);
    });
    this.deviceMap = {};
    this.artistInfo = '';
    this.trackInfo = 'AirHome';

    var dataServer = dgram.createSocket("udp4");

    dataServer.bind(broadcastPort, '0.0.0.0', function() {
        dataServer.setBroadcast(true);
        dataServer.setMulticastTTL(128);
        dataServer.setMulticastLoopback(true);
        dataServer.addMembership(broadcastIP);

        // readRadio();
    });

    this.dataServer = dataServer;
};



module.exports.BroadcastPlayer = BroadcastPlayer;

util.inherits(BroadcastPlayer, events.EventEmitter);

BroadcastPlayer.prototype.setChannelUrl = function(channelId, channelUrl, stationName) {
    console.log('playing URL ' + channelUrl + ' and storing id ' + channelId);
    this.currentChannelId = channelId;
    this.currentChannelUrl = channelUrl;
    this.iceStreamer.playUrl(channelUrl, stationName);
};

BroadcastPlayer.prototype.getChannelId = function() {
    return this.currentChannelId;
};

BroadcastPlayer.prototype.getChannelUrl = function() {
    return this.currentChannelUrl;
};

BroadcastPlayer.prototype.addDevice = function(deviceId, deviceIp, socket, clientToken) {
    console.log('adding device ' + deviceIp);
    if (this.deviceMap[deviceIp] != null) {
        return null;
    }
    var newDevice = {
        "id": deviceId,
        "ip": deviceIp,
        "socket": socket,
        "volume": 0,
        "latency": 1000,
        "clientToken": clientToken
    };
    var self = this;
    socket.emit('listen_on', {
        client: deviceIp,
        broadcast: this.broadcastIP,
        clientToken: newDevice.clientToken
    });
    console.log('[BROADCAST] setting listen on for ' + socket.id + ' to ' + deviceIp);
    /*
    newDevice.on('status', function(status) {
        console.log('status: ' + status);
        if(status == 'stopped') {
            self.deviceMap[deviceIp] = null;
            self.emit("deviceClosed", deviceId);
        }
    });
    */
    this.deviceMap[deviceIp] = newDevice;
    console.log('[BROADCAST] set trackinfo to ' + this.trackInfo);
    //airtunes.setTrackInfo(newDevice.key, this.trackInfo, this.artistInfo, '', function() {
    //});
    return deviceIp;
};

BroadcastPlayer.prototype.delDevice = function(deviceIp) {
    console.log('removing host ' + deviceIp);
    var device = this.deviceMap[deviceIp];
    if (device == null) {
        return false;
    }
    console.log('[BROADCAST] sending listen off for ' + device.socket.id + ' to ' + deviceIp + ' ' + device.socket);
    device.socket.emit('listen_off', {
        client: deviceIp,
        broadcast: this.broadcastIP,
        clientToken: device.clientToken
    });
    this.deviceMap[deviceIp] = null;
    return true;
};

BroadcastPlayer.prototype.setVolume = function(deviceIp, volume) {
    var device = this.deviceMap[deviceIp];
    if (device == null) {
        return false;
    }
    device.socket.emit('set_volume', {
        client: deviceIp,
        volume: volume,
        clientToken: device.clientToken
    });
    device.volume = volume;
};

BroadcastPlayer.prototype.setLatency = function(deviceIp, latency) {
    var device = this.deviceMap[deviceIp];
    if (device == null) {
        return false;
    }
    device.socket.emit('set_latency', {
        client: deviceIp,
        latency: latency,
        clientToken: device.clientToken
    });
};

BroadcastPlayer.prototype.onTrackInfo = function(data) {
    this.artistInfo = data.station;
    this.trackInfo = data.title;
    this.updateTrackInfo();
};

BroadcastPlayer.prototype.onStreamReady = function(data) {
    console.log('received stream ready, playing stream now');
    var source = data.source;
    var self = this;
    source.on("data", function(data) {
//        console.log('received data to transmit :-)');
        self.dataServer.send(data, 0, data.length, self.broadcastPort, self.broadcastIP);
    });
    // source.pipe(airtunes);
};

BroadcastPlayer.prototype.onStreamClosed = function() {
    this.artistInfo = '';
    this.trackInfo = 'Muroau';
    this.updateTrackInfo();
};

BroadcastPlayer.prototype.updateTrackInfo = function() {
    if (this.artistInfo == null) {
        this.artistInfo = '';
    }
    for (var key in this.deviceMap) {
        if (this.deviceMap.hasOwnProperty(key)) {
            var device = this.deviceMap[key];
            if (device != null) {
                // airtunes.setTrackInfo(device.key, this.trackInfo, this.artistInfo, '');
                console.log('setting track info for ' + device.key);
            }
        }
    }
    console.log('updated track info with name ' + this.trackInfo);
};