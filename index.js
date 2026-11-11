let https = require('https');
let util = require('util');
let mqtt = require('mqtt');
const commandLineArgs = require('command-line-args');

let MQTTclient;
let access_token;
let got_new_token = false;
let all_done = false;

const optionDefinitions = [
	{ name: 'path', alias: 'p', type: String, defaultValue: "prognosis/pv" },
	{ name: 'bind', alias: 'b', type: String },
	{ name: 'token', alias: 't', type: Boolean, defaultValue: false },
	{ name: 'id', alias: 'i', type: String, defaultValue: "pvprognosis" },
	{ name: 'debug', alias: 'd', type: Boolean, defaultValue: false },
	{ name: 'mqtthost', alias: 'm', type: String },
	{ name: 'name', alias: 'n', type: String },
	{ name: 'latitude', alias: 'l', type: Number, defaultValue: 48.070833 },
	{ name: 'longitude', alias: 'L', type: Number, defaultValue: 11.202778 },
	{ name: 'factor', alias: 'f', type: Number, defaultValue: 22 },
	{ name: 'retry', alias: 'r', type: Number, defaultValue: 3 },
	{ name: 'skip', alias: 's', type: Boolean, defaultValue: false }
];

const options = commandLineArgs(optionDefinitions);

if (options.mqtthost) {
	MQTTclient = mqtt.connect("mqtt://" + options.mqtthost);
	MQTTclient.on("connect", function () {
		if (options.debug) {
			console.log("MQTT connected");
		}
		MQTTclient.subscribe(options.path + "/token");
		init();
	})

	MQTTclient.on("error", function (error) {
		console.error("Can't connect: " + error);
		process.exit(1)
	});
	MQTTclient.on('message', function (topic, message, packet) {
		try {
			if ((!options.token || got_new_token) && topic.includes("token")) {
				access_token = message;
				if(all_done == false ) {
					if(options.debug) {
						console.log("got token: ", access_token.toString());
					}
					start();
				}
			}
		} catch (error) {
			console.error("Error  : ", error);
			console.error("Message: ", message.toString());
		}
	});
} else {
	start();
}


async function getAccessToken() {
	return new Promise((resolve, reject) => {
		const postData = JSON.stringify({ "apiType": "m-weather-eapi" });
		const opt = {
			hostname: 'xp-prod.frontend-author.basfagri-prod.magnolia-platform.io',
			port: 443,
			path: '/api/generateToken',
			method: 'POST',
			timeout: 3000,
			localAddress: options.bind,
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(postData)
			}
		};

		let req = https.request(opt, function (res) {
			let body = '';
			res.on('data', function (chunk) {
				body += chunk;
			});
			res.on('end', function () {
				let response;
				try {
					response = JSON.parse(body);
				} catch (e) {
					reject(e.message);
					return;
				}
				if (response.access_token == undefined) {
					reject("No access token received");
					return;
				}
				resolve(response.access_token);
			});
		}).on('error', function (e) {
			console.error("Got error: " + e.message);
			reject(e.message);
		});
		req.write(postData);
	});
}

async function sendMqtt(data, retain_flag=true) {
	MQTTclient.publish(options.path + "/" + options.name, JSON.stringify(data), { retain: retain_flag });
}

async function getForecast(access_token) {
	return new Promise((resolve, reject) => {
		https.get("https://prod-ap.inthub.basf.com/m-weather/v1/weatherDetails?lang=de&latitude=" + options.latitude + "&longitude=" + options.longitude + "&siteidentifier=DE&cachesize=5", {
			timeout: 3000,
			localAddress: options.bind,
			headers: {
				'Authorization': 'Bearer ' + access_token
			}
		}, function (res) {
			let body = '';
			res.on('data', function (chunk) {
				body += chunk;
			});
			res.on('end', function () {
				let response;
				try {
					response = JSON.parse(body);
				} catch (e) {
					reject(e.message);
					return;
				}
				let datecnt = 0;
				let obj = {};
				let skipped = false;
				let first = true;
				if(options.debug) {
					console.log("response: ", response);
				}
				obj.lastUpdated = response.lastUpdated;
				response.days1h.forEach(day => {
					for (const key in day) {
						let datestr = response.day1h.isotime[datecnt];
						let dayradwm2 = 0;
						day[key].forEach(hour => {
							let isodate = response.day1h.isotime[datecnt++];
							dayradwm2 += hour.radwm2;
							if (options.debug) {
								console.log("hour: " + isodate, " radwm2: " + hour.radwm2);
							}
						});
						if (options.skip == false || skipped == true) {
							//obj[datestr] = dayradwm2;
							const date = new Date(datestr);
							let energy = (dayradwm2 * options.factor) / 1000;
							energy = energy.toFixed(0);
							console.log(date.toDateString() + " : " + dayradwm2 + "w/m2 / " + energy + "kWh");
							obj["energy"] = parseInt(energy);
							obj["time"] = datestr;
							if (options.debug) {
								console.log(util.inspect(obj));
							}
							if (options.mqtthost) {
								sendMqtt(obj, first);
								first = false;
							}
						} else {
							skipped = true;
						}
					}
				});
				resolve(obj);
			});
		}).on('error', function (e) {
			console.error("Got error: " + e.message);
			reject(e.message);
		});
	});
}

async function init() {
	if(options.debug) {
		console.log("init: ", options.token);
	}
	if(options.token) {
		access_token = await getAccessToken().catch((e) => { console.error("Error getting access token: " + e); process.exit(1) });
		if(options.debug) {
			console.log("Access token: " + access_token);
		}
		MQTTclient.publish(options.path + "/token", access_token, { retain: true });
		got_new_token = true;
	} 
}

async function start() {
	let tries = options.retry;
	try {
		while (access_token != undefined && tries && all_done == false) {
			let obj = await getForecast(access_token).catch((e) => { tries-- });
			if (obj && Object.keys(obj).length) {
				if (options.debug) {
					console.log("MQTT host     : " + options.mqtthost);
					console.log("MQTT Client ID: " + options.id);
					console.log("MQTT path     : " + options.path)
				}
				obj.latitude = options.latitude;
				obj.longitude = options.longitude;
				obj.factor = options.factor;
				console.log("\nName          : " + options.name);
				console.log("Latitude      : " + obj.latitude);
				console.log("Longitude     : " + obj.longitude);
				console.log("Factor        : " + obj.factor);
				console.log("Last updated  : " + obj.lastUpdated);
				all_done = true;
			}
		}
		if (options.mqtthost) {
			MQTTclient.end();
		}
		process.exit(1);
	}  catch (error) {
			console.error("Error  : ", error);
			console.error("Message: ", message.toString());
	}
}
