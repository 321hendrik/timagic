(function () {
	/**
	 * Requirements
	 */
	var cli = require('cli');
	var Q = require('q');
	var path = require('path');
	var logic = require('./logic');
	var pkg = require('../package.json');

	/**
	 * CLI Configuration
	 */

	// show app info for every action
	var arg = process.argv.slice(2).shift();
	if (arg != '-v' && arg != '--version') {
		console.log(logic.color('cyan', '\n' + pkg.name + ' ' + pkg.version + ' created by ' + pkg.author.name + ' (' + pkg.author.email + ') \n'));
	}

	cli.enable('version');
	cli.setApp(pkg.name, pkg.version + ' created by ' + pkg.author.name + ' (' + pkg.author.email + ')');

	cli.parse({
		'iosv': ['i', 'Set ios version for build', 'string'],
		'debug': ['d', 'Show command output for debugging'],
		'shadow': ['s', 'Start TiShadow live reload ("npm install -g tishadow")'],
		'appify': ['a', 'Build TiShadow client app wrapper'],
		'live': ['l', 'Use appcelerator liveview'],
		'suffix': ['x', 'suffix to use for microsite path (e.g. app001/test -> http://base.url/app001/test)', 'string'],
		'build': ['b', 'use with microsite to create binaries too'],
		'log-level': ['g', 'set log level of build commands. defaults to error', 'string']
	}, ['clean', 'apk', 'ipa', 'ipad', 'iphone', 'microsite', 'setup', 'install', 'todevice', 'remove']);

	/**
	 * Main execution
	 */
	cli.main(function(args, options) {

		var env = {
			cwd: process.cwd(),
			folderName: process.cwd().split('/').pop(),
			execDir: process.argv[1]
		};

		var params = {
			command: cli.command,
			args: args,
			options: options
		};

		var settings = {
			adb_path: '/Applications/android-sdk-macosx/platform-tools/adb',
			apk_output_path: path.join(env.cwd, 'dist'),
			keystore_path: false,
			keystore_alias: false,
			keystore_pw: false,
			ipa_output_path: path.join(env.cwd, 'dist'),
			distribution_name: false,
			pp_uuid: false,
			distribution_path: path.join(env.cwd, 'dist_sites'),
			distribution_base_url: false,
			latest_ios_version: '',
			enable_notifications: true
		};

		var tiapp;

		// load configuration
		logic.loadConfig()
			.then(function (data) {
				// check if config has been setup
				return logic.gatherConfig(data, params)
					.then(function (data) {
						// exit here for setup command
						if (cli.command == 'setup') {
							cli.ok('Setup saved');
							throw '';
						} else {
							// overwrite with info from config
							for (var key in settings) {
								if (data[key]) {
									settings[key] = data[key];
								}
							}
							return true;
						}
					})
				;
			})
			// get tiappxml data
			.then(function () {
				return require('./tiapp').init(env.cwd);
			})
			// init tiapp module and assign to var
			.then(function (data) {
				tiapp = data;
				return true;
			})
			// get latest installed ios sdk version
			.then(logic.getLatestIosSdkVersion)
			.then(function (data) {
				if (data) {
					settings['latest_ios_version'] = data;
				}
				return true;
			})
			// Run method code
			.then(function () {

				var methodStrings = {
					'clean': {
						indicatorString: 'Cleaning',
						showNotification: true
					},
					'apk': {
						indicatorString: 'Creating APK',
						showNotification: true
					},
					'ipa': {
						indicatorString: 'Creating IPA',
						showNotification: true
					},
					'microsite': {
						indicatorString: 'Creating Microsite',
						showNotification: true
					},
					'iphone': {
						singleLog: 'Starting iPhone Simulator',
					},
					'ipad': {
						singleLog: 'Starting iPad Simulator'
					},
					'install': {
						indicatorString: 'Building app and installing to connected devices',
						showNotification: true
					},
					'todevice': {
						indicatorString: 'Installing prebuild app to connected devices',
						showNotification: true
					},
					'remove': {
						indicatorString: 'Removing app from connected devices',
						showNotification: true
					}
				};

				var indicatorString = methodStrings[cli.command].indicatorString;
				if (indicatorString) {
					cli.spinner(indicatorString + '...');
				}

				var showNotification = methodStrings[cli.command].showNotification;

				var singleLog = methodStrings[cli.command].singleLog;
				if (singleLog) {
					cli.debug(singleLog);
				}

				logic[cli.command](env, settings, tiapp, params)
					.then(function (data) {
						if (indicatorString) {
							cli.spinner(indicatorString + '...done!', true);
						}
						// show a system notification
						if (settings['enable_notifications'] && showNotification) {
							cli.exec('which osascript', function (data) {
								var notificationTitle = 'TiMagic Success';
								var notificationText = indicatorString + '...done!';
								cli.exec('osascript -e \'display notification \"' + notificationText + '\" with title \"' + notificationTitle + '\"\'');
							}, function () {});
						}
					})
					.catch(function (err) {
						if (indicatorString) {
							cli.spinner(indicatorString + '...failed!', true);
						}
						cli.error(err);
						// show a system notification
						if (settings['enable_notifications'] && showNotification) {
							cli.exec('which osascript', function (data) {
								var notificationTitle = 'TiMagic Error';
								var notificationText = indicatorString + '...failed!';
								cli.exec('osascript -e \'display notification \"' + notificationText + '\" with title \"' + notificationTitle + '\"\'');
							}, function () {});
						}
					})
				;
			})
			.catch(function (err) {
				if (err) {
					cli.error(err);
				}
			})
		;
	});
}).call(this);