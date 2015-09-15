/**
 * Module for handling tiapp.xml file information
 */
(function () {
	var Q = require('q');
	var path = require('path');
	var fs = require('fs');
	var xml2js = require('xml2js');

	function init (basePath) {
		var deferred = Q.defer();

		var filePath = path.join(basePath, 'tiapp.xml');

		fs.readFile(filePath, 'utf8', function (err, data) {
			if (err) {
				deferred.reject(err);
				return;
			}

			var parser = new xml2js.Parser();

			parser.parseString(data.substring(0, data.length), function (err, result) {
				if (err) {
					deferred.reject(err);
					return;
				}

				var TiApp = {
					data: result['ti:app'],
					get: function (key) {
						var data = this.data;

						value = data[key];

						if (typeof value == 'undefined' || !value.length) {
							return;
						}

						return value[0];
					}
				};

				deferred.resolve(TiApp);
			});
		});

		return deferred.promise;
	}

	module.exports = {
		init: init
	};
}).call(this);