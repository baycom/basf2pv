var https = require('https');
var util = require('util');
var mqtt = require('mqtt');
const commandLineArgs = require('command-line-args');
const { Console } = require('console');

var MQTTclient;

const optionDefinitions = [
	{ name: 'path', alias: 'p', type: String, defaultValue: "yield/prognosis/pv" },
	{ name: 'id', alias: 'i', type: String, defaultValue: "pvprognosis" },
	{ name: 'debug', alias: 'd', type: Boolean, defaultValue: false },
	{ name: 'mqtthost', alias: 'm', type: String },
	{ name: 'latitude', alias: 'l', type: Number, defaultValue: 48.070833 },
	{ name: 'longitude', alias: 'L', type: Number, defaultValue: 11.202778 },
	{ name: 'factor', alias: 'f', type: Number, defaultValue: 22 },
];

const options = commandLineArgs(optionDefinitions)

if (options.debug) {
	console.log("MQTT host     : " + options.mqtthost);
	console.log("MQTT Client ID: " + options.id);
	console.log("MQTT path     : " + options.path)
	console.log("Latitude      : " + options.latitude);
	console.log("Longitude     : " + options.longitude);
	console.log("Factor        : " + options.factor);
}

function sendMqtt(data) {
	MQTTclient.publish(options.path + "/" + options.latitude + "/" + options.longitude, JSON.stringify(data));
}

if (options.mqtthost) {
	MQTTclient = mqtt.connect("mqtt://" + options.mqtthost, { clientId: options.id });
	MQTTclient.on("connect", function () {
		if (options.debug) {
			console.log("MQTT connected");
		}
	})

	MQTTclient.on("error", function (error) {
		console.log("Can't connect" + error);
		process.exit(1)
	});
}

setTimeout(function () {
	process.exit();
}, 1000);


https.get("https://www.agrar.basf.de/api/weather/weatherDetails?lang=de&latitude=" + options.latitude + "&longitude=" + options.longitude, function (res) {
	var body = '';
	res.on('data', function (chunk) {
		body += chunk;
	});
	res.on('end', function () {
		var response = JSON.parse(body);
		var datecnt = 0;
		var obj = {};

		console.log("Last updated: " + response.lastUpdated);
		obj.lastUpdated = response.lastUpdated;
		response.days1h.forEach(day => {
			for (const key in day) {
				var datestr = response.day1h.isotime[datecnt];
				var dayradwm2 = 0;
				day[key].forEach(hour => {
					var isodate = response.day1h.isotime[datecnt++]
					dayradwm2 += hour.radwm2;
				});
				obj[datestr] = dayradwm2 = dayradwm2;
				console.log(datestr + " : " + dayradwm2 + "w/m2 / " + (dayradwm2 * 22) / 1000 + "kWh");
			}
		});
		if (options.debug) {
			console.log(util.inspect(obj));
		}
		if (options.mqtthost) {
			sendMqtt(obj);
		}
	});
}).on('error', function (e) {
	console.log("Got error: " + e.message);
});
