(function () {
	/**
	 * Dependencies
	 */
	var cli = require('cli').enable('version');
	var Q = require('q');
	var exec = require('child_process').exec;
	var spawn = require('child_process').spawn;
	var path = require('path');
	var fs = require('fs');
	var mkdirpOriginal = require('mkdirp');
	var readline = require('readline');

	/**
	 * Basic cli command for appcelerator titanium
	 * @type {String}
	 */
	var tiBase = 'titanium';

	var logLevel = ['--log-level', 'error'];

	/**
	 * Execute a command as a child process
	 * @param  {String|Array} cmd
	 * @param  {Boolean|String} bool -> show output 'spawn' -> spawn child
	 * @return {Promise}     Q-Promise
	 */
	function execChild (cmd, showOutput) {
		var deferred = Q.defer();

		if (!cmd) {
			deferred.reject('no command given');
			return deferred.promise;
		}

		// check for array as cmd input
		if (typeof cmd != 'string' && cmd.length) {
			cmd = cmd.join(' ');
		}
		var child;
		if (showOutput == 'spawn') {
			child = spawn('/bin/sh', ['-c', cmd], { stdio: 'inherit' });

			child.on('close', function (code) {
				if (code !== 0) {
					deferred.reject('command exited with code: ' + code + '\n(' + cmd + ')');
				} else {
					deferred.resolve(code);
				}
			});
			child.on('error', function (err) {
				deferred.reject(err);
			});

		} else {
			child = exec(cmd, {
				maxBuffer: 10000*1024 // aim high for titanium build process
			}, function (error, stdout, stderr) {
				if (error) {
					deferred.reject(error);
					return;
				}
				deferred.resolve(stdout);
			});

			if (showOutput) {
				child.stdout.on('data', function (data) {
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
	 * Wrapper function to reuse simulator for ipad and iphone
	 * @param  {String} device "ipad" or "iphone"
	 * @return {Function}
	 */
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

			var cmd = [tiBase, 'build', '-d', env.cwd, '-s', sdkVersion, '-p', 'ios', '-I', iosVersion, '-Y', device, '-S', iosVersion, '-T', 'simulator', '--skip-js-minify'];

			if (params.options.live) {
				cmd.push('--liveview');
			}

			if (params.options.shadow) {
				cmd.push('--shadow');
			}

			if (params.options.appify) {
				cmd.push('--appify');
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

		/*jshint multistr: true */
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
		var ipa_link = project_url + '/' + params['title'] + '.ipa';
		var title_with_version = params['title'] + ' (' + params['bundle_version'] + ')';

		/*jshint multistr: true */
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
						.visible {\
							display: block;\
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
							{{TITLE}}\
							<div class="link visible">\
								<a href="{{IPA LINK}}">Download For iOS</a>\
							</div>\
							<div class="link visible">\
								<a href="{{ANDROID LINK}}">Download For Android</a>\
							</div>\
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
		html = html.replace(/{{IPA LINK}}/g, ipa_link);
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
	 * Promise wrapper for fs.writeFile
	 * @param  {String} filePath
	 * @param  {Mixed} data
	 * @return {Promise}          Q-Promise
	 */
	function writeFile (filePath, data) {
		var deferred = Q.defer();

		fs.writeFile(filePath, data, function (err) {
			if (err) {
				deferred.reject(err);
				return;
			}
			deferred.resolve(true);
		});

		return deferred.promise;
	}

	/**
	 * Promise wrapper for fs.readFile
	 * @param  {String} filePath
	 * @return {Promise}          Q-Promise
	 */
	function readFile (filePath) {
		var deferred = Q.defer();

		fs.readFile(filePath, function (err, data) {
			if (err) {
				deferred.reject(err);
				return;
			}
			deferred.resolve(data);
		});

		return deferred.promise;
	}

	/**
	 * Load data from config.json
	 * @return {Promise} 		Q-Promise
	 */
	function loadConfig () {
		return readFile( path.join(__dirname, 'config.json') )
			.then(function (data) {
				return JSON.parse(data);
			})
		;
	}

	/**
	 * Save data to config.json
	 * @param  {Object} config
	 * @return {Promise}        Q-Promise
	 */
	function saveConfig (config) {
		config = JSON.stringify(config);

		return writeFile( path.join(__dirname, 'config.json'), config )
			.then(function () {
				return config;
			})
		;
	}

	/**
	 * Promise based command line prompt
	 * @param  {Object} obj    the object to enrich with input data
	 * @param  {String} key    key to assign input data to
	 * @param  {String} prompt prompt message string
	 * @return {Promise}        Q-Promise
	 */
	function getInput (obj, key, prompt) {
		var deferred = Q.defer();

		var rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});

		var isBool = (typeof obj[key] == 'boolean');
		var currVal = (isBool) ? ((!!obj[key]) ? 'y' : 'n') : obj[key];

		rl.question(prompt + '[' + currVal + ']' + ' ', function (answer) {
			// check for 'x' to reset entry
			if (answer == 'x') {
				obj[key] = '';
			} else {
				// add quotes if spaces are contained
				if (answer.indexOf(' ') > -1) {
					answer = '\"' + answer + '\"';
				}
				// assign answer to object
				if (answer) {
					if (isBool) {
						obj[key] = (answer == 'y');
					} else {
						obj[key] = answer;
					}
				}
			}

			rl.close();
			deferred.resolve(obj);
		});

		return deferred.promise;
	}

	/**
	 * Wrap a string with terminal color codes
	 * @param  {String} colorName color name (e.g. pink, blue, ...)
	 * @param  {String} string    the string to wrap
	 * @return {String}           string with color codes attached
	 */
	function color (colorName, string) {
		var colors = {
			'pink': 35,
			'blue': 34,
			'yellow': 33,
			'green': 32,
			'cyan': 36,
			'red': 31,
			'white': 0
		};
		return '\x1B['+(colors[colorName] || 0)+'m' + string + '\x1B['+colors['white']+'m';
	}

	/**
	 * Gathers config data through a series of command line prompts and saves it to config.json
	 * @param  {Object} config
	 * @param  {Object} params
	 * @return {Promise}        Q-Promise
	 */
	function gatherConfig (config, params) {
		var deferred = Q.defer();

		if (!config['setup'] || params.command == 'setup') {
			if (!config['setup']) {
				console.log(color('yellow', '\nNo configuration detected, running first time setup...(you can rerun the setup later with "timagic setup")'));
			}

			console.log('\n________SETUP________ ! Use "x" to clear entry !');
			console.log('\n* Android Config');

			return getInput(config, 'adb_path', 'Enter your ADB executable path:')
				.then(function (data) {
					return getInput(config, 'keystore_path', 'Enter your Android Keystore path:')
				})
				.then(function (data) {
					return getInput(config, 'keystore_alias', 'Enter your Android Keystore alias:')
				})
				.then(function (data) {
					return getInput(config, 'keystore_pw', 'Enter your Android Keystore password:')
				})
				.then(function (data) {
					return getInput(config, 'apk_output_path', 'Enter the path to save APKs to (will be saved to ./dist by default):')
				})
				.then(function (data) {
					console.log('\n* iOS Config');
					return getInput(config, 'distribution_name', 'Enter your iOS certificate\'s distribution name:')
				})
				.then(function (data) {
					return getInput(config, 'pp_uuid', 'Enter your iOS certificate\s PP_UUID:')
				})
				.then(function (data) {
					return getInput(config, 'ipa_output_path', 'Enter the path to save IPAs to (will be saved to ./dist by default):')
				})
				.then(function (data) {
					console.log('\n* Microsite Distribution Config');
					return getInput(config, 'distribution_base_url', 'Enter the base url where your Microsite will be available (e.g. http.//your.domain.com/):')
				})
				.then(function (data) {
					return getInput(config, 'distribution_path', 'Enter the path where to save the Microsite files (will be saved to ./dist_sites by default):')
				})
				.then(function (data) {
					console.log('\n* Notification Settings (OS X only)');
					return getInput(config, 'enable_notifications', 'Enable build notifications?(y|n):')
				})
				// save gathered config
				.then(function (data) {
					console.log('');
					data['setup'] = true;
					return saveConfig(data);
				})
			;
		} else {
			deferred.resolve(config);
			return deferred.promise;
		}
	}

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

		if (params.options['log-level']) {
			logLevel = ['--log-level', params.options['log-level']];
		}
		cmd = cmd.concat(logLevel);

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

		if (params.options['log-level']) {
			logLevel = ['--log-level', params.options['log-level']];
		}
		cmd = cmd.concat(logLevel);

		if (params.options.appify) {
			cmd.push('--appify');
		}

		return execChild(cmd, 'spawn')
			.then(function () {
				return path.join(outputPath, tiapp.get('name') + '.apk');
			})
		;
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

		var outputPath = params.outputPath || settings['ipa_output_path'];

		// end if android is not defined as deployment target
		if (deploymentTargets.indexOf('ios') < 0) {
			var deferred = Q.defer();
			deferred.reject('ios is not defined as deployment target in your project\'s tiapp.xml');
			return deferred.promise;
		}

		var cmd = [tiBase, 'build', '-d', env.cwd, '-s', sdkVersion, '-p', 'ios', '-R', settings['distribution_name'], '-P', settings['pp_uuid'], '-O', outputPath, '-T', 'dist-adhoc'];

		if (params.options['log-level']) {
			logLevel = ['--log-level', params.options['log-level']];
		}
		cmd = cmd.concat(logLevel);

		if (params.options.iosv) {
			cmd = cmd.concat(['-I', params.options.iosv]);
		}

		if (params.options.appify) {
			cmd.push('--appify');
		}

		return execChild(cmd, 'spawn')
			.then(function () {
				return path.join(outputPath, tiapp.get('name') + '.ipa');
			})
		;
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
			.then(function () {
				if (params.options.build) {
					var deploymentTarget = getDeploymentTargets(tiapp.get('deployment-targets'));

					params.outputPath = distFolder;

					var promises = [];
					// android build
					if (deploymentTarget.indexOf('android') > -1) {
						promises.push(apk(env, settings, tiapp, params));
					}
					// ios build
					if (deploymentTarget.indexOf('ios') > -1) {
						promises.push(ipa(env, settings, tiapp, params));
					}
					return Q.all(promises);
				} else {
					return true;
				}
			})
		;

		return promise;
	}

	/**
	 * Get list of connected android devices
	 * @param  {String} adbPath
	 * @return {Promise}         Q-Promise
	 */
	function getAndroidDeviceList (adbPath) {
		var cmd = [adbPath, 'devices'];

		return execChild(cmd)
			.then(function (data) {
				data = data.replace(/\tdevice/g,'').split('\n').slice(1,-2);
				return data;
			})
		;
	}

	/**
	 * Tests if libimobiledevice is installed
	 * @return {Boolean} [description]
	 */
	function hasLibimobiledevice () {
		var cmd = ['which', 'ideviceinstaller'];
		return execChild(cmd)
			.then(function (data) {
				return {hasLibimobiledevice: (data.indexOf('not found') === -1)};
			})
	}

	/**
	 * Get list of connected iOS devices (needs libimobiledevice)
	 * @return {Promise}         Q-Promise
	 */
	function getIosDeviceList () {
		var cmd = 'system_profiler SPUSBDataType | sed -n "/iP/,/Serial/p" | grep "Serial Number:"';

		return execChild(cmd)
			.then(function (data) {
				data = data.replace(/\s+Serial Number:\s+/g,'').split('\n').slice(0,-1);
				return data;
			})
			.catch(function (err) {})
		;
	}

	/**
	 * Install APK to a connected device
	 * @param  {String} adbPath  path to adb executable
	 * @param  {String} deviceId device id from "adb devices"
	 * @param  {String} apkPath  path to apk to be installed
	 * @return {Promise}          Q-Promise
	 */
	function apkToDevice (adbPath, deviceId, apkPath) {
		var cmd = [adbPath, '-s', deviceId, 'install', '-r', apkPath];

		return execChild(cmd)
			.then(function (data) {
				if (data.indexOf('Success') > -1) {
					return {deviceId: deviceId, success: true};
				} else {
					return {deviceId: deviceId, err: data};
				}
			})
		;
	}

	/**
	 * Install IPA to a connected device
	 * @param  {String} deviceId device udid
	 * @param  {String} ipaPath  path to ipa to be installed
	 * @return {Promise}          Q-Promise
	 */
	function ipaToDevice (deviceId, ipaPath) {
		var cmd = ['ideviceinstaller', '-u', deviceId, '-g', ipaPath];

		return execChild(cmd)
			.then(function (data) {
				if (data.indexOf('Complete') > -1) {
					return {deviceId: deviceId, success: true};
				} else {
					return {deviceId: deviceId, err: data};
				}
			})
		;
	}

	/**
	 * Get the activity name for a given app name
	 * @param  {String} appName app name
	 * @return {String}         activity name
	 */
	function getActivityNameFromAppName (appName) {
		var activityName = appName;
		// lowercase
		activityName = activityName.toLowerCase()
		// mark seperator chars
		activityName = activityName.replace(/\W/g, '$%&');
		// split on markers
		activityName = activityName.split('$%&');
		// capitalize
		for (var i = 0; i < activityName.length; i++) {
			activityName[i] = activityName[i].charAt(0).toUpperCase() + activityName[i].slice(1);
		}
		// join
		activityName = activityName.join('');
		// add suffix
		activityName += 'Activity';

		return activityName;
	}

	/**
	 * Start activity on android device
	 * @param  {String} adbPath  path to adb executable
	 * @param  {String} deviceId id of device to start activity on
	 * @param  {String} appId    application id
	 * @param  {String} appName  application name
	 * @return {Promise}          Q-Promise
	 */
	function startActivity (adbPath, deviceId, appId, appName) {
		var activityName = getActivityNameFromAppName(appName);

		var startParam = appId + '/' + appId + '.' + activityName;
		var cmd = [adbPath, '-s', deviceId, 'shell', 'am', 'start', '-n', startParam];

		return execChild(cmd)
			.then(function (data) {
				if (data.indexOf('Error') > -1) {
					console.log(color('red', 'Could start activity ' + activityName + ' on device ' + deviceId), err);
				}
				return true;
			})
		;
	}

	/**
	 * Wrapper function to reuse install with and without binary build
	 * @param  {Boolean} withBuild
	 * @return {Function}
	 */
	function installWrapper (withBuild) {
		/**
		 * Install app to all connected devices & genymotion simulator
		 * @param  {Object} env     paths
		 * @param  {Object} settings settings
		 * @param {Object} tiapp module to get information from tiapp.xml
		 * @param  {Object} params  additional parameters
		 * @return {Promise}         Q-Promise
		 */
		return function install (env, settings, tiapp, params) {
			var androidDeviceList = [];
			var iosDeviceList = [];
			var libimobiledeviceInstalled = false;
			var installedToDevices = 0;

			// get list of connected devices
			return getAndroidDeviceList(settings['adb_path'])
				// if any android devices are connected
				.then(function (data) {
					androidDeviceList = data;
					if (!androidDeviceList || !androidDeviceList.length) {
						androidDeviceList = [];
					}
					return true;
				})
				// check for libimobiledevice
				.then(hasLibimobiledevice)
				.then(function (data) {
					if (data.hasLibimobiledevice) {
						libimobiledeviceInstalled = true;
						// if any android devices are connected
						return getIosDeviceList()
							.then(function (data) {
								iosDeviceList = data;

								if (!iosDeviceList || !iosDeviceList.length) {
									iosDeviceList = [];
								}
								return true;
							})
						;
					}
					cli.info('Not installing to iOS devices. (Please install libimobiledevice --> "homebrew install libimobiledevice")');
					return true;
				})
				// should build?
				.then(function () {
					var outputPaths = {};

					if (!withBuild) {
						outputPaths.apk = path.join(settings['apk_output_path'], tiapp.get('name') + '.apk');
						outputPaths.ipa = path.join(settings['ipa_output_path'], tiapp.get('name') + '.ipa');
						return outputPaths;
					}

					var promises = [];

					if (androidDeviceList.length) {
						promises.push(apk(env, settings, tiapp, params));
					}
					if (iosDeviceList.length && libimobiledeviceInstalled) {
						promises.push(ipa(env, settings, tiapp, params));
					}

					return Q.all(promises)
						.then(function (paths) {
							outputPaths = {};
							for (var i = 0; i < paths.length; i++) {
								if (paths[i].indexOf('.ipa') !== -1) {
									outputPaths.ipa = paths[i];
								}
								if (paths[i].indexOf('.apk') !== -1) {
									outputPaths.apk = paths[i];
								}
							}
							return outputPaths;
						})
					;
				})
				// install to connected android devices
				.then(function (outputPaths) {
					var noneInstalled = true;

					var promises = [];

					// Install to android devices
					for (var i = 0; i < androidDeviceList.length; i++) {
						(function (i) {
							var promise = apkToDevice(settings['adb_path'], androidDeviceList[i], outputPaths.apk)
								// show install status
								.then(function (data) {
									installedToDevices++;
									console.log('\n' + installedToDevices + '/' + (androidDeviceList.length + iosDeviceList.length), 'devices');
									return data;
								})
								// check install status
								.then(function (data) {
									if (data.success) {
										noneInstalled = false;
									} else {
										console.log(color('red', '\nCould not install to ' + data.deviceId + ' err: ' + data.err));
									}
									return data;
								})
								// try to start activity on device
								.then(function (data) {
									return startActivity(settings['adb_path'], androidDeviceList[i], tiapp.get('id'), tiapp.get('name'));
								})
							;
							promises.push(promise);
						})(i);
					}

					// Install to iOS device
					for (var i = 0; i < iosDeviceList.length; i++) {
						(function (i) {
							var promise = ipaToDevice(iosDeviceList[i], outputPaths.ipa)
								// show install status
								.then(function (data) {
									installedToDevices++;
									console.log('\n' + installedToDevices + '/' + (androidDeviceList.length + iosDeviceList.length), 'devices');
									return data;
								})
								// check install status
								.then(function (data) {
									if (data.success) {
										noneInstalled = false;
									} else {
										console.log(color('red', '\nCould not install to ' + data.deviceId + ' err: ' + data.err));
									}
									return data;
								})
								// @TODO implement app launch
							;
							promises.push(promise);
						})(i);
					}

					// wait for all installs to finish
					return Q.all(promises)
						.then(function () {
							if (!(androidDeviceList.length + iosDeviceList.length)) {
								throw new Error('There are no devices connected. Please try to reconnect them.')
							}
							if (noneInstalled) {
								throw new Error('App could not be installed to any device.')
							}
						})
					;
				})
			;
		}
	}

	/**
	 * Remove APK from a connected device
	 * @param  {String} adbPath  path to adb executable
	 * @param  {String} deviceId device id from "adb devices"
	 * @param  {String} appId  application id
	 * @return {Promise}          Q-Promise
	 */
	function removeApkFromDevice (adbPath, deviceId, appId) {
		var cmd = [adbPath, '-s', deviceId, 'uninstall', appId];

		return execChild(cmd)
			.then(function (data) {
				if (data.indexOf('Success') > -1) {
					return {deviceId: deviceId, success: true};
				} else {
					return {deviceId: deviceId, err: data};
				}
			})
		;
	}

	/**
	 * Remove IPA from a connected device
	 * @param  {String} deviceId device UDID
	 * @param  {String} appId  application id
	 * @return {Promise}          Q-Promise
	 */
	function removeIpaFromDevice (deviceId, appId) {
		var cmd = ['ideviceinstaller', '-u', deviceId, '-U', appId];

		return execChild(cmd)
			.then(function (data) {
				if (data.indexOf('Complete') > -1) {
					return {deviceId: deviceId, success: true};
				} else {
					return {deviceId: deviceId, err: data};
				}
			})
		;
	}

	/**
	 * Remove app from all connected devices & genymotion simulator
	 * @param  {Object} env     paths
	 * @param  {Object} settings settings
	 * @param {Object} tiapp module to get information from tiapp.xml
	 * @param  {Object} params  additional parameters
	 * @return {Promise}         Q-Promise
	 */
	function remove (env, settings, tiapp, params) {
		var androidDeviceList = [];
		var iosDeviceList = [];
		var libimobiledeviceInstalled = false;
		var removedFromDevices = 0;

		// get list of connected devices
		return getAndroidDeviceList(settings['adb_path'])
			// if any devices are connected
			.then(function (data) {
				androidDeviceList = data;

				if (!androidDeviceList || !androidDeviceList.length) {
					androidDeviceList = [];
				}
				return true;
			})
			// check for libimobiledevice
			.then(hasLibimobiledevice)
			.then(function (data) {
				if (data.hasLibimobiledevice) {
					libimobiledeviceInstalled = true;
					// if any android devices are connected
					return getIosDeviceList()
						.then(function (data) {
							iosDeviceList = data;

							if (!iosDeviceList || !iosDeviceList.length) {
								iosDeviceList = [];
							}
							return true;
						})
					;
				}
				cli.info('Not installing to iOS devices. (Please install libimobiledevice --> "homebrew install libimobiledevice")');
				return true;
			})
			.then(function () {
				var noneRemoved = true;

				var promises = [];

				// remove from android devices
				for (var i = 0; i < androidDeviceList.length; i++) {
					(function (i) {
						var promise = removeApkFromDevice(settings['adb_path'], androidDeviceList[i], tiapp.get('id'))
							// show remove status
							.then(function (data) {
								removedFromDevices++;
								console.log('\n' + removedFromDevices + '/' + (androidDeviceList.length + iosDeviceList.length), 'devices');
								return data;
							})
							// check remove status
							.then(function (data) {
								if (data.success) {
									noneRemoved = false;
								} else {
									console.log(color('red', '\nCould not remove from ' + data.deviceId + ' err: ' + data.err));
								}
								return data;
							})
						;
						promises.push(promise);
					})(i);
				}

				// remove from ios devices
				for (var i = 0; i < iosDeviceList.length; i++) {
					(function (i) {
						var promise = removeIpaFromDevice(iosDeviceList[i], tiapp.get('id'))
							// show remove status
							.then(function (data) {
								removedFromDevices++;
								console.log('\n' + removedFromDevices + '/' + (androidDeviceList.length + iosDeviceList.length), 'devices');
								return data;
							})
							// check remove status
							.then(function (data) {
								if (data.success) {
									noneRemoved = false;
								} else {
									console.log(color('red', '\nCould not remove from ' + data.deviceId + ' err: ' + data.err));
								}
								return data;
							})
						;
						promises.push(promise);
					})(i);
				}

				// wait for all removes to finish
				return Q.all(promises)
					.then(function () {
						if (!(androidDeviceList.length + iosDeviceList.length)) {
							throw new Error('There are no devices connected. Please try to reconnect them.')
						}
						if (noneRemoved) {
							throw new Error('App could not be removed on any devices.')
						}
					})
				;
			})
		;
	}

	module.exports = {
		getLatestIosSdkVersion: getLatestIosSdkVersion,
		loadConfig: loadConfig,
		saveConfig: saveConfig,
		gatherConfig: gatherConfig,
		color: color,
		clean: clean,
		apk: apk,
		ipa: ipa,
		iphone: simWrapper('iphone'),
		ipad: simWrapper('ipad'),
		microsite: microsite,
		install: installWrapper(true),
		todevice: installWrapper(false),
		remove: remove
	};
}).call(this);