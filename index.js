var https = require('https');
var util = require('util');
var mqtt = require('mqtt');
const commandLineArgs = require('command-line-args');

var MQTTclient;

const optionDefinitions = [
	{ name: 'path', alias: 'p', type: String, defaultValue: "agg/prognosis/pv" },
	{ name: 'id', alias: 'i', type: String, defaultValue: "pvprognosis" },
	{ name: 'debug', alias: 'd', type: Boolean, defaultValue: false },
	{ name: 'mqtthost', alias: 'm', type: String },
	{ name: 'latitude', alias: 'l', type: Number, defaultValue: 48.070833 },
	{ name: 'longitude', alias: 'L', type: Number, defaultValue: 11.202778 },
	{ name: 'factor', alias: 'f', type: Number, defaultValue: 22 },
	{ name: 'retry', alias: 'r', type: Number, defaultValue: 3 },
	{ name: 'skip', alias: 's', type: Boolean, defaultValue: false }
];

const options = commandLineArgs(optionDefinitions);

if (options.mqtthost) {
	MQTTclient = mqtt.connect("mqtt://" + options.mqtthost, { clientId: options.id });
	MQTTclient.on("connect", function () {
		if (options.debug) {
			console.log("MQTT connected");
		}
		start();
	})

	MQTTclient.on("error", function (error) {
		console.log("Can't connect" + error);
		process.exit(1)
	});
} else {
	start();
}

async function sendMqtt(data) {
	MQTTclient.publish(options.path + "/" + options.latitude + "/" + options.longitude, JSON.stringify(data), { retain: true });
	MQTTclient.end();
}

async function getForecast() {
	return new Promise((resolve, reject) => {
		https.get("https://www.agrar.basf.de/api/weather/weatherDetails?lang=de&latitude=" + options.latitude + "&longitude=" + options.longitude, {
			timeout: 3000
		}, function (res) {
			var body = '';
			res.on('data', function (chunk) {
				body += chunk;
			});
			res.on('end', function () {
				var response;
				try {
					response = JSON.parse(body);
				} catch (e) {
					reject(e.message);
					return;
				}
				var datecnt = 0;
				var obj = {};
				var skipped = false;

				console.log("Last updated: " + response.lastUpdated);
				obj.lastUpdated = response.lastUpdated;
				response.days1h.forEach(day => {
					for (const key in day) {
						var datestr = response.day1h.isotime[datecnt];
						var dayradwm2 = 0;
						day[key].forEach(hour => {
							var isodate = response.day1h.isotime[datecnt++];
							dayradwm2 += hour.radwm2;
						});
						if (options.skip == false || skipped == true) {
							obj[datestr] = dayradwm2;
							const date = new Date(datestr);
							console.log(date.toDateString() + " : " + dayradwm2 + "w/m2 / " + (dayradwm2 * options.factor) / 1000 + "kWh");
						} else {
							skipped = true;
						}
					}
				});
				if (options.debug) {
					console.log(util.inspect(obj));
				}
				resolve(obj);
			});
		}).on('error', function (e) {
			console.log("Got error: " + e.message);
			reject(e.message);
		});
	});
}

async function start() {
	var tries = options.retry;
	while (tries) {
		var obj = await getForecast().catch((e) => { tries-- });
		if (obj && Object.keys(obj).length) {
			if (options.debug) {
				console.log("MQTT host     : " + options.mqtthost);
				console.log("MQTT Client ID: " + options.id);
				console.log("MQTT path     : " + options.path)
			}
			console.log("\nLatitude      : " + options.latitude);
			console.log("Longitude     : " + options.longitude);
			console.log("Factor        : " + options.factor);
			if (options.mqtthost) {
				await sendMqtt(obj);
			}
			break;
		}
	}
}
