(function () {
	var cli = require('cli').enable('version');
	var Q = require('q');
	var exec = require('child_process').exec;
	var spawn = require('child_process').spawn;
	var path = require('path');
	var fs = require('fs');
	var mkdirpOriginal = require('mkdirp');

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
		if (showOutput == 'spawn') {
			var child = spawn('/bin/sh', ['-c', cmd], { stdio: 'inherit' });

			child.on('close', function (code) {
				deferred.resolve(code);
			});
			child.on('error', function (err) {
				deferred.reject(err);
			});

		} else {
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
				if ((['iphone', 'ipad'].indexOf(target) > -1) && (strTargets.indexOf('ios') < 0)) {
					strTargets.push('ios')
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

		return execChild(cmd, 'spawn');
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

		var outputPath = params.outputPath || settings['apk_output_path'];

		// end if android is not defined as deployment target
		if (deploymentTargets.indexOf('android') < 0) {
			var deferred = Q.defer();
			deferred.reject('android is not defined as deployment target in your project\'s tiapp.xml');
			return deferred.promise;
		}

		var cmd = [tiBase, 'build', '-d', env.cwd, '-s', sdkVersion, '-p', 'android', '-K', settings['keystore_path'], '-L', settings['keystore_alias'], '--store-password', settings['keystore_pw'], '-O', outputPath, '-T', 'dist-playstore'];

		return execChild(cmd, 'spawn');
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
		var iosVersion = params.options['iosv'] || settings['latest_ios_version'];

		var outputPath = params.outputPath || settings['ipa_output_path'];

		// end if android is not defined as deployment target
		if (deploymentTargets.indexOf('ios') < 0) {
			var deferred = Q.defer();
			deferred.reject('ios is not defined as deployment target in your project\'s tiapp.xml');
			return deferred.promise;
		}

		var cmd = [tiBase, 'build', '-d', env.cwd, '-s', sdkVersion, '-p', 'ios', '-R', settings['distribution_name'], '-I', iosVersion, '-P', settings['pp_uuid'], '-O', outputPath, '-T', 'dist-adhoc'];

		return execChild(cmd, 'spawn');
	}

	function simWrapper (device) {
		/**
		 * Launch Simulator
		 * @param  {Object} env     paths
		 * @param  {Object} settings settings
		 * @param {Object} tiapp module to get information from tiapp.xml
		 * @param  {Object} params  additional parameters
		 * @return {Promise}         Q-Promise
		 */
		return function simulator (env, settings, tiapp, params) {

			var sdkVersion = tiapp.get('sdk-version');
			var deploymentTargets = getDeploymentTargets(tiapp.get('deployment-targets'));
			var iosVersion = params.options['iosv'] || settings['latest_ios_version'];

			// end if android is not defined as deployment target
			if ((deploymentTargets.indexOf('ios') < 0) || (deploymentTargets.indexOf(device) < 0)) {
				var deferred = Q.defer();
				deferred.reject(device + ' is not defined as deployment target in your project\'s tiapp.xml');
				return deferred.promise;
			}

			var cmd = [tiBase, 'build', '-d', env.cwd, '-s', sdkVersion, '-p', 'ios', '-I', iosVersion, '-Y', device, '-S', iosVersion, '-T', 'simulator'];

			if (params.options.shadow) {
				cmd.push('--shadow');
			}

			return execChild(cmd, 'spawn');
		}
	}

	/**
	 * Generate plist-file for app distribution
	 * @param  {Object} params
	 *      url: 'http://base.url/',
	 *      suffix: 'proj001',
	 *      title: 'App',
	 *      bundle_id: 'com.company.app',
	 *      bundle_version: '1.0.0'
	 *      savePath: '~/test.plist'
	 *
	 * @return {String}        plist file as string
	 */
	function genPLIST (params) {
		var deferred = Q.defer();

		var url = params['url'] + params['suffix'] + '/' + params['title'] + '.ipa';

		var plist = '\
		<?xml version="1.0" encoding="UTF-8"?>\
			<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\
			<plist version="1.0">\
			<dict>\
				<key>items</key>\
				<array>\
					<dict>\
						<key>assets</key>\
						<array>\
							<dict>\
								<key>kind</key>\
								<string>software-package</string>\
								<key>url</key>\
								<string>{{URL}}</string>\
							</dict>\
						</array>\
						<key>metadata</key>\
						<dict>\
							<key>bundle-identifier</key>\
							<string>{{BUNDLE ID}}</string>\
							<key>bundle-version</key>\
							<string>{{BUNDLE VERSION}}</string>\
							<key>kind</key>\
							<string>software</string>\
							<key>title</key>\
							<string>{{TITLE}}</string>\
						</dict>\
					</dict>\
				</array>\
			</dict>\
			</plist>\
		';
		plist = plist.replace(/{{URL}}/g, url);
		plist = plist.replace(/{{BUNDLE ID}}/g, params['bundle_id']);
		plist = plist.replace(/{{BUNDLE VERSION}}/g, params['bundle_version']);
		plist = plist.replace(/{{TITLE}}/g, params['title']);

		fs.writeFile(params.savePath, plist, function (err) {
			if (err) {
				deferred.reject(err);
				return;
			}
			deferred.resolve(true);
		});

		return deferred.promise;
	}

	/**
	 * Generate html-file for app distribution
	 * @param  {Object} params
	 *         url: 'http://base.url/',
	 *         suffix: 'proj001',
	 *         title: 'App',
	 *         dateString: '31.01.2015 13:01',
	 *         bundle_version: '1.0.0'
	 *         savePath: '~/test.html'
	 *
	 * @return {String}        html file as string
	 */
	function genHTML (params) {
		var deferred = Q.defer();

		var project_url = params['url'] + params['suffix'];
		var ios_link = project_url + '/' + 'manifest.plist';
		var android_link = project_url + '/' + params['title'] + '.apk';
		var title_with_version = params['title'] + ' (' + params['bundle_version'] + ')';

		var html = '\
			<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\
			<html xmlns="http://www.w3.org/1999/xhtml">\
				<head>\
					<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />\
					<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">\
					<title>{{TITLE}}</title>\
					<style type="text/css">\
						body {\
							background: #eee;\
							margin: 0;\
							padding: 0;\
							font-family: verdana,helvetica,sans-serif;\
							text-align: center;\
							padding: 10px;\
							font-size: 16px;\
						}\
						#container {\
							width:300px;\
							margin:0 auto;\
						}\
						.headline {\
							margin:0;\
							padding:0;\
							font-size:16px;\
						}\
						p {\
							font-size:13px;\
						}\
						.link {\
							display: none;\
							border: 1px solid #1f8dc5;\
							margin-top: .5em;\
							padding: .3em;\
						}\
						.link a {\
							text-decoration:none;\
							font-size:15px;\
							display:block;\
							color:#1f8dc5;\
						}\
						.last_updated {\
							font-size: x-small;\
							text-align: center;\
							font-style: italic;\
						}\
						.created_with {\
							font-size: x-small;\
							text-align: center;\
						}\
						.created_with a {\
							color: #aaa;\
						}\
						#no-device-info {\
							display: none;\
						}\
					</style>\
				</head>\
				<body>\
					<div id="container">\
						<p><img src="Icon.png" length="57" width="57" /></p>\
						<p class="headline">Install Link</p>\
						<div id="ios-link" class="link">\
							<a href="itms-services://?action=download-manifest&url={{IOS LINK}}">Tap Here to Install<br />{{TITLE}}<br />Directly On Your iOS Device</a>\
						</div>\
						<div id="android-link" class="link">\
							<a href="{{ANDROID LINK}}">Tap Here to Install<br />{{TITLE}}<br />Directly On Your Android Device</a>\
						</div>\
						<div id="no-device-info">\
							<p>Make sure you are visiting this page on your device, not your computer.<br /></p>\
						</div>\
						<p class="last_updated">Last Updated: {{CURRENT DATE}}</p>\
					</div>\
					<script type="text/javascript">\
						var device = navigator.userAgent;\
						if ((device.indexOf("iPhone") > -1) || (device.indexOf("iPad") > -1)) {\
							document.getElementById("ios-link").style.display = "block";\
						} else if (device.indexOf("Android") > -1) {\
							document.getElementById("android-link").style.display = "block";\
						} else {\
							document.getElementById("no-device-info").style.display = "block";\
						}\
					</script>\
				</body>\
			</html>\
		';

		html = html.replace(/{{TITLE}}/g, title_with_version);
		html = html.replace(/{{ANDROID LINK}}/g, android_link);
		html = html.replace(/{{IOS LINK}}/g, ios_link);
		html = html.replace(/{{CURRENT DATE}}/g, params['dateString']);

		fs.writeFile(params.savePath, html, function (err) {
			if (err) {
				deferred.reject(err);
				return;
			}
			deferred.resolve(true);
		});

		return deferred.promise;
	}

	/**
	 * Adds padding to a number (1 -> '01')
	 * @param {Number} value
	 * @param {String} character  padding character
	 * @param {Number} length number of padding characters to add
	 * @return {String} padded number
	 */
	function addPadding (value, character, length) {
		character = character || '0';
		var stringValue = String(value);
		while (stringValue.length < length) {
			stringValue = '0' + stringValue;
		}
		return stringValue;
	}

	/**
	 * Pretty format a date
	 * @param  {Object} date js date object
	 * @return {String}      formatted string
	 */
	function formatDate (date) {
		var dateStr = addPadding(date.getDate(), '0', 2) + '.' + addPadding((date.getMonth() + 1), '0', 2) + '.' + date.getFullYear();
		var timeStr = addPadding(date.getHours(), '0', 2) + ':' + addPadding(date.getMinutes(), '0', 2);

		return dateStr + ' ' + timeStr;
	}

	/**
	 * Promise wrapper for mkdirp
	 * @param  {String} pathString
	 * @return {Promise}            Q-Promise
	 */
	function mkdirp (pathString) {
		var deferred = Q.defer();

		mkdirpOriginal(pathString, function (err) {
			if (err) {
				deferred.reject(err);
				return;
			}
			deferred.resolve(true);
		});

		return deferred.promise;
	}

	/**
	 * Promise based file copy
	 * @param  {String} source
	 * @param  {String} destination
	 * @return {Promise}            Q-Promise
	 */
	function cp (source, destination) {
		var deferred = Q.defer();

		var cbCalled = false;

		var rd = fs.createReadStream(source);
		rd.on("error", function(err) {
			done(err);
		});
		var wr = fs.createWriteStream(destination);
		wr.on("error", function(err) {
			done(err);
		});
		wr.on("close", function(ex) {
			done();
		});

		rd.pipe(wr);

		function done(err) {
			if (!cbCalled) {
				if (err) {
					deferred.reject(err);
				} else {
					deferred.resolve(true);
				}
				cbCalled = true;
			}
		}

		return deferred.promise;
	}

	/**
	 * Create microsite for app deployment
	 * @param  {Object} env     paths
	 * @param  {Object} settings settings
	 * @param {Object} tiapp module to get information from tiapp.xml
	 * @param  {Object} params  additional parameters
	 * @return {Promise}         Q-Promise
	 */
	function microsite (env, settings, tiapp, params) {
		// create dist_site folder and subfolders
		var distFolder = path.join(settings['distribution_path'], (params.options.suffix || env.folderName));

		// create folder
		var promise = mkdirp(distFolder)
			// cp icon file
			.then(function () {
				var iconname = tiapp.get('icon');
				var iconnameHighRes = iconname.split('.').join('@2x.');

				var source = path.join(env.cwd, 'Resources', 'iphone', iconnameHighRes);
				var destination = path.join(distFolder, 'Icon.png');

				return cp(source, destination);
			})
			// create plist
			.then(function () {
				return genPLIST({
					url: settings['distribution_base_url'],
					suffix: params.options.suffix || env.folderName,
					title: tiapp.get('name'),
					bundle_id: tiapp.get('id'),
					bundle_version: tiapp.get('version'),
					savePath: path.join(distFolder, 'manifest.plist')
				});
			})
			// create html
			.then(function () {
				return genHTML({
					url: settings['distribution_base_url'],
					suffix: params.options.suffix || env.folderName,
					title: tiapp.get('name'),
					dateString: formatDate(new Date()),
					bundle_version: tiapp.get('version'),
					savePath: path.join(distFolder, 'index.html')
				});
			})
		;

		if (params.options.build) {
			var deploymentTarget = getDeploymentTargets(tiapp.get('deployment-targets'));

			params.outputPath = distFolder;

			// android build
			if (deploymentTarget.indexOf('android') > -1) {
				promise.then(function () {
					return apk(env, settings, tiapp, params);
				});
			}

			// ios build
			if (deploymentTarget.indexOf('ios') > -1) {
				promise.then(function () {
					return ipa(env, settings, tiapp, params);
				});
			}
		}

		return promise;
	}

	module.exports = {
		getLatestIosSdkVersion: getLatestIosSdkVersion,
		clean: clean,
		apk: apk,
		ipa: ipa,
		iphone: simWrapper('iphone'),
		ipad: simWrapper('ipad'),
		microsite: microsite
	};
}).call(this);