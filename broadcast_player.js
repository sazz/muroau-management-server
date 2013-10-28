/**
 * Created by SazzSomewhere on 29.10.13.
 */
var events = require('events');
var iceStreamerModule = require('./icestreamer');
var util = require('util');

var BroadcastPlayer = function() {

};

module.exports.BroadcastPlayer = BroadcastPlayer;

util.inherits(BroadcastPlayer, events.EventEmitter);

BroadcastPlayer.prototype.setChannelUrl = function(channelId, channelUrl, stationName) {
};

BroadcastPlayer.prototype.getChannelId = function() {
    return this.currentChannelId;
};

BroadcastPlayer.prototype.getChannelUrl = function() {
    return this.currentChannelUrl;
};

BroadcastPlayer.prototype.addDevice = function(deviceId, deviceIp) {
    console.log('adding device ' + deviceIp);
    if (this.deviceMap[deviceIp] != null) {
        return null;
    }
    var newDevice = {}; // airtunes.add(deviceIp, 5000);
    var self = this;
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
    // device.stop();
    this.deviceMap[deviceIp] = null;
    return true;
};

BroadcastPlayer.prototype.setVolume = function(deviceIp, volume) {
    var device = this.deviceMap[deviceIp];
    if (device == null) {
        return false;
    }
    /*
    device.setVolume(volume, function() {
        console.log('setting volume on ' + deviceIp + ' to ' + volume);
    });
    */
};

BroadcastPlayer.prototype.onTrackInfo = function(data) {
    this.artistInfo = data.station;
    this.trackInfo = data.title;
    this.updateTrackInfo();
};

BroadcastPlayer.prototype.onStreamReady = function(data) {
    console.log('received stream ready, playing stream now');
    var source = data.source;
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