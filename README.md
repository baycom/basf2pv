This simple script extracts radiation data forecasts from german 'BASF Agrarwetter' data. It prints out the upcoming 7 days and publishes a MQTT message with thse data.

Usage:
node index.js --latitude 48.070833 --longitude 11.202778 --mqtthost mqtt-server --factor 22

Last updated: 14:54
2023-10-08T15:00+0200 : 1499w/m2 / 32.978kWh
2023-10-09T01:00+0200 : 2588w/m2 / 56.936kWh
2023-10-10T01:00+0200 : 3417w/m2 / 75.174kWh
2023-10-11T01:00+0200 : 3592w/m2 / 79.024kWh
2023-10-12T01:00+0200 : 2423w/m2 / 53.306kWh
2023-10-13T01:00+0200 : 3159w/m2 / 69.498kWh
2023-10-14T01:00+0200 : 2641w/m2 / 58.102kWh
2023-10-15T01:00+0200 : 2040w/m2 / 44.88kWh
2023-10-16T01:00+0200 : 1310w/m2 / 28.82kWh
2023-10-17T01:00+0200 : 2426w/m2 / 53.372kWh
2023-10-18T01:00+0200 : 1958w/m2 / 43.076kWh
2023-10-19T01:00+0200 : 1669w/m2 / 36.718kWh
2023-10-20T01:00+0200 : 1919w/m2 / 42.218kWh
2023-10-21T01:00+0200 : 1843w/m2 / 40.546kWh
2023-10-22T01:00+0200 : 1811w/m2 / 39.842kWh
2023-10-23T01:00+0200 : 866w/m2 / 19.052kWh
