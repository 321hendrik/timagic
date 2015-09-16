(function () {
	/**
	 * Requirements
	 */
	var cli = require('cli');
	var Q = require('q');
	var path = require('path');
	var logic = require('./logic');

	/**
	 * CLI Configuration
	 */
	var appname = 'TiMagic';
	var currVersion = '0.2.0';
	var author = 'Hendrik Elsner';
	var email = '321hendrik@gmail.com';

	console.log(logic.color('cyan', '\n' + appname + ' ' + currVersion + ' created by ' + author + ' (' + email + ') \n'));

	cli.enable('version');

	cli.setApp(appname, currVersion + ' created by ' + author + ' (' + email + ')');

	cli.parse({
		'iosv': ['i', 'Set ios version for build', 'string'],
		'debug': ['d', 'Show command output for debugging'],
		'shadow': ['s', 'Use TiShadow ("npm install -g tishadow")'],
		'suffix': ['x', 'suffix to use for microsite path (e.g. app001/test -> http://base.url/app001/test)', 'string'],
		'build': ['b', 'use with microsite to create binaries too']
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
			latest_ios_version: ''
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
					'test': {
						indicatorString: 'Testing'
					},
					'clean': {
						indicatorString: 'Cleaning'
					},
					'apk': {
						indicatorString: 'Creating APK'
					},
					'ipa': {
						indicatorString: 'Creating IPA'
					},
					'microsite': {
						indicatorString: 'Creating Microsite'
					},
					'iphone': {
						singleLog: 'Starting iPhone Simulator',
					},
					'ipad': {
						singleLog: 'Starting iPad Simulator'
					},
					'install': {
						indicatorString: 'Building app and installing to connected devices'
					},
					'todevice': {
						indicatorString: 'Installing prebuild app to connected devices'
					},
					'remove': {
						indicatorString: 'Removing app from connected devices'
					}
				};

				var indicatorString = methodStrings[cli.command].indicatorString;
				if (indicatorString) {
					cli.spinner(indicatorString + '...');
				}

				var singleLog = methodStrings[cli.command].singleLog;
				if (singleLog) {
					cli.debug(singleLog);
				}

				logic[cli.command](env, settings, tiapp, params)
					.then(function (data) {
						if (indicatorString) {
							cli.spinner(indicatorString + '...done!', true);
						}
						// console.log(data);
					})
					.catch(function (err) {
						if (indicatorString) {
							cli.spinner(indicatorString + '...failed!', true);
						}
						cli.error(err);
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