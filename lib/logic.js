(function () {
	var Q = require('q');

	function test () {
		var deferred = Q.defer();

		path = process.cwd();

		setTimeout(function () {
			deferred.resolve(path);
		}, 1500);

		return deferred.promise;
	}

	module.exports = {
		test: test
	};
}).call(this);