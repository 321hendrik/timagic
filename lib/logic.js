(function () {
	var cli = require('cli').enable('version');
	var Q = require('q');
	var exec = require('child_process').exec;
	var path = require('path');
	var fs = require('fs');

	/**
	 * Execute a command as a child process
	 * @param  {String|Array} cmd
	 * @return {Promise}     Q-Promise
	 */
	function execChild (cmd, showOutput) {
		var deferred = Q.defer();

		if (!cmd) {
			deferred.reject('no command given');
			return;
		}

		// check for array as cmd input
		if (typeof cmd != 'string' && cmd.length) {
			cmd = cmd.join(' ');
		}

		var childProcess = exec(cmd, {
			maxBuffer: 10000*1024 // aim high for titanium build process
		}, function (error, stdout, stderr) {
			if (error) {
				deferred.reject(error);
				return;
			}
			deferred.resolve(stdout);
		});

		if (showOutput) {
			childProcess.stdout.on('data', function (data) {
				cli.info(data);
			});
		}

		return deferred.promise;
	}

	/**
	 * Extract deployment targets as array from parsed xml-Object
	 * @param  {Object} tiappDeploymentTargets parsed xml-Object from tiapp.js
	 * @return {Object}                        array of targets as strings (e.g.: ['android', 'ios'])
	 */
	function getDeploymentTargets (tiappDeploymentTargets) {
		var strTargets = [];

		tiappDeploymentTargets = tiappDeploymentTargets.target;

		for (var i = 0; i < tiappDeploymentTargets.length; i++) {
			if (tiappDeploymentTargets[i]['_'] == 'true') {
				var target = tiappDeploymentTargets[i]['$']['device'];
				if (['iphone', 'ipad'].indexOf(target) > -1) {
					target = 'ios';
				}
				strTargets.push(target);
			}
		}
		return strTargets;
	}

	/**
	 * Return the version number of the most recent installed ios sdk
	 * @return {String} ios sdk version
	 */
	function getLatestIosSdkVersion () {
		var cmd = ['xcodebuild', '-showsdks', '|', 'grep', '"iphoneos"'];
		return execChild(cmd)
			.then(function (data) {
				data = data.replace('\n', '').split('iphoneos')
				if (data.length > 0) {
					return data[data.length-1];
				} else {
					return '';
				}
			})
		;
	}

	/**
	 * Print out method parameters
	 * @param  {Object} env     paths
	 * @param  {Object} settings settings
	 * @param {Object} tiapp module to get information from tiapp.xml
	 * @param  {Object} params  additional parameters
	 * @return {Promise}         Q-Promise
	 */
	function test (env, settings, tiapp, params) {
		var deferred = Q.defer();

		setTimeout(function () {
			deferred.resolve({
				env: env,
				settings: settings,
				params: params
			});
		}, 1500);

		return deferred.promise;
	}

	/**
	 * Basic cli command for appcelerator titanium
	 * @type {String}
	 */
	var tiBase = 'titanium';

	/**
	 * Clean projects build folder
	 * @param  {Object} env     paths
	 * @param  {Object} settings settings
	 * @param {Object} tiapp module to get information from tiapp.xml
	 * @param  {Object} params  additional parameters
	 * @return {Promise}         Q-Promise
	 */
	function clean (env, settings, tiapp, params) {
		var cmd = [tiBase, 'clean', '-d', env.cwd];

		return execChild(cmd, params.options.debug);
	}

	/**
	 * Build APK
	 * @param  {Object} env     paths
	 * @param  {Object} settings settings
	 * @param {Object} tiapp module to get information from tiapp.xml
	 * @param  {Object} params  additional parameters
	 * @return {Promise}         Q-Promise
	 */
	function apk (env, settings, tiapp, params) {

		var sdkVersion = tiapp.get('sdk-version');
		var deploymentTargets = getDeploymentTargets(tiapp.get('deployment-targets'));

		// end if android is not defined as deployment target
		if (deploymentTargets.indexOf('android') < 0) {
			var deferred = Q.defer();
			deferred.reject('android is not defined as deployment target in your project\'s tiapp.xml');
			return deferred.promise;
		}

		var cmd = [tiBase, 'build', '-d', env.cwd, '-s', sdkVersion, '-p', 'android', '-K', settings['keystore_path'], '-L', settings['keystore_alias'], '--store-password', settings['keystore_pw'], '-O', settings['apk_output_path'], '-T', 'dist-playstore'];

		return execChild(cmd, params.options.debug);
	}

	/**
	 * Build IPA
	 * @param  {Object} env     paths
	 * @param  {Object} settings settings
	 * @param {Object} tiapp module to get information from tiapp.xml
	 * @param  {Object} params  additional parameters
	 * @return {Promise}         Q-Promise
	 */
	function ipa (env, settings, tiapp, params) {

		var sdkVersion = tiapp.get('sdk-version');
		var deploymentTargets = getDeploymentTargets(tiapp.get('deployment-targets'));
		var iosVersion = params.options['ios-version'] || settings['latest_ios_version'];

		// end if android is not defined as deployment target
		if (deploymentTargets.indexOf('ios') < 0) {
			var deferred = Q.defer();
			deferred.reject('ios is not defined as deployment target in your project\'s tiapp.xml');
			return deferred.promise;
		}

		var cmd = [tiBase, 'build', '-d', env.cwd, '-s', sdkVersion, '-p', 'ios', '-R', settings['distribution_name'], '-I', iosVersion, '-P', settings['pp_uuid'], '-O', settings['ipa_output_path'], '-T', 'dist-adhoc'];

		return execChild(cmd, params.options.debug);
	}

	module.exports = {
		getLatestIosSdkVersion: getLatestIosSdkVersion,
		test: test,
		clean: clean,
		apk: apk,
		ipa: ipa
	};
}).call(this);