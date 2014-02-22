
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  ,	mysql	= require('mysql')
  , connectionsArray	= []
  , connection	= mysql.createConnection({
      user : 'airhome',
      password : 'airhome',
      database : 'airhome'
      // socketPath: '/var/run/mysqld/mysqld.sock'
  })
  , POLLING_INTERVAL = 3000
  , pollingTimer
  , zoneManagerModule = require('./zonemanager.js');

var app = express();
var deviceMap = {};
var speakerIpMap = {};
var channelMap = {};
var zoneManager = new zoneManagerModule.ZoneManager();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);

var connectedSpeakerMap = {};
var connectedSocketMap = {};
var connectedSpeakerCounter = 0;

var server = http.createServer(app);
var io = require('socket.io').listen(server);
io.set('log level', 0);
server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});



//creating a new websocket to keep the content updated without any AJAX request
io.sockets.on( 'connection', function ( socket ) {
    socket.set('log level', 0);
	console.log('Number of connections:' + connectionsArray.length);
	// starting the loop only if at least there is one user connected
	if (!connectionsArray.length) {
		pollingLoop();
	}
//    socket.set('log level', 0);
	socket.on('disconnect', function () {
		var socketIndex = connectionsArray.indexOf( socket );
		console.log('socket = ' + socketIndex + ' disconnected');
		if (socketIndex >= 0) {
			connectionsArray.splice( socketIndex, 1 );
		}
	});
	socket.on("speakerChange", function(data) {
		console.log("speaker " + data.id + " changed to " + data.selected + " and volume " + data.volume);
        var speakerData = connectedSpeakerMap[data.id];
		if (data.selected && speakerData != undefined) {
			zoneManager.addHost('zoneA', data.id, speakerData.ip, connectedSocketMap[data.id], speakerData.clientToken);
		} else {
			zoneManager.delHost(data.id);
		}
	});
	socket.on("volumeChange", function(data) {
		console.log("volume change for " + data.id + " with volume " + data.volume);
		zoneManager.setVolume(data.id, data.volume);
	});
    socket.on("latencyChange", function(data) {
        console.log("latency change for " + data.id + " with latency " + data.latency);
        zoneManager.setLatency(data.id, data.latency);
    });
	socket.on("channelChange", function(data) {
		console.log("channel " + data.id + " set.");
		var channelData = channelMap[data.id];
		zoneManager.setZoneChannelUrl('zoneA', data.id, channelData.url, channelData.title);
	});
	console.log( 'A new socket is connected!' );
	connectionsArray.push( socket );

});

var updateSockets = function ( data ) {
	// adding the time of the last update
	data.time = new Date();
	// sending new data to all the sockets connected
	connectionsArray.forEach(function( tmpSocket ){
		tmpSocket.volatile.emit( 'notification' , data );
	});
};

var pollingLoop = function () {
	// Doing the database query
	var channelQuery = connection.query('SELECT id, title, url FROM channels ORDER BY order_number ASC');
	var channels = [], speakers = []; // this array will contain the result of our db query
	var channelDone = false, speakerDone = false;
	// setting the query listeners

	channelQuery.on('error', socketError).on('result', function( channel ) {
		// it fills our array looping on each user row inside the db
		channelMap[channel.id] = {
				title: channel.title,
				url: channel.url
		};
		channel.selected = channel.id == zoneManager.getZoneChannelId('zoneA');
		channels.push( channel );
	}).on('end', function() {
        for (var speakerIP in connectedSpeakerMap) {
            var speakerElement = connectedSpeakerMap[speakerIP];
            if (speakerElement != null) {
                if (zoneManager.getZoneId(speakerElement.id) == 'zoneA') {
                    speakerElement.selected = true;
                } else {
                    speakerElement.selected = undefined;
                }
                speakerElement.volume = zoneManager.getVolume(speakerElement.id);
                speakerElement.latency = zoneManager.getLatency(speakerElement.id);
                speakers.push(speakerElement);
            }
        }
		updateClientStatus(channels, speakers);
	});
};

function updateClientStatus(channels, speakers) {
	// loop on itself only if there are sockets still connected
	if(connectionsArray.length) {
		pollingTimer = setTimeout( pollingLoop, POLLING_INTERVAL );

		updateSockets({channels:channels, speakers:speakers});
	}
}
function socketError(err) {
	// Handle error, and 'end' event will be emitted after this as well
	console.log( err );
	updateSockets( err );
}

var ntp = require('socket-ntp');
var controlIO = require('socket.io').listen(4666);
controlIO.sockets.on('connection', function(socket) {
    ntp.sync(socket);
    var clientAddress = socket.handshake.address;
    var clientIP = clientAddress.address;
    socket.on('welcome', function(data) {
        console.log('[CONTROL] received welcome from ' + data.name + ' ' + clientAddress.address + ' ' + socket.id);
        var speakerId = connectedSpeakerCounter++;
        connectedSpeakerMap[speakerId] = {
            "title": data.name,
            "ip": clientIP,
            "volume": 0,
            "zone": null,
            "order_number": speakerId,
            "id": speakerId,
            "clientToken": data.clientToken,
            "selected": undefined
        };
        connectedSocketMap[speakerId] = socket;
        socket.set("close timeout", 10);
        socket.on('disconnect', function() {
            console.log("[CONTROL] received disconnect");
            connectedSpeakerMap[speakerId] = undefined;
        });
    });
});

