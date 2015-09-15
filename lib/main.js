(function () {
	/**
	 * Requirements
	 */
	var cli = require('cli').enable('version');
	var nconf = require('nconf');
	var Q = require('q');
	var path = require('path');
	var logic = require('./logic');
	var config = require('./config');

	/**
	 * CLI Configuration
	 */
	cli.setApp('TiMagic', '0.0.3');
	cli.parse({
		'ios-version': ['i', 'Set ios version for build'],
		'debug': ['d', 'Show command output for debugging']
	}, [
		'test', 'clean', 'apk', 'ipa'
	]);

	/**
	 * Main execution
	 */
	cli.main(function(args, options) {

		var env = {
			cwd: process.cwd(),
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
			distribution_path: path.join(env.cwd, 'deploy'),
			distribution_base_url: false,
			latest_ios_version: ''
		};

		// overwrite with info from config
		for (var key in settings) {
			if (config[key]) {
				settings[key] = config[key];
			}
		}

		var tiapp;
		// get tiappxml data<
		require('./tiapp').init(env.cwd)
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
				// console.log('args', args);
				// console.log('options', options);
				// console.log('settings', settings);

				var methodString = '';

				if (cli.command == 'test') {
					methodString = 'Testing';
					cli.spinner(methodString + '...');

					logic.test(env, settings, tiapp, params)
						.then(function (data) {
							cli.spinner(methodString + '...done!', true);
							console.log(data);
						})
						.catch(function (err) {
							cli.spinner(methodString + '...failed!', true);
							cli.error(err);
						})
					;
				}

				if (cli.command == 'clean') {
					methodString = 'Cleaning Repository';
					cli.spinner(methodString + '...');

					logic.clean(env, settings, tiapp, params)
						.then(function (data) {
							cli.spinner(methodString + '...done!', true);
						})
						.catch(function (err) {
							cli.spinner(methodString + '...failed!', true);
							cli.error(err);
						})
					;
				}

				if (cli.command == 'apk') {
					methodString = 'Creating APK';
					cli.spinner(methodString + '...');

					logic.apk(env, settings, tiapp, params)
						.then(function (data) {
							cli.spinner(methodString + '...done!', true);
						})
						.catch(function (err) {
							cli.spinner(methodString + '...failed!', true);
							cli.error(err);
						})
					;
				}

				if (cli.command == 'ipa') {
					methodString = 'Creating IPA';
					cli.spinner(methodString + '...');

					logic.ipa(env, settings, tiapp, params)
						.then(function (data) {
							cli.spinner(methodString + '...done!', true);
						})
						.catch(function (err) {
							cli.spinner(methodString + '...failed!', true);
							cli.error(err);
						})
					;
				}
			})
			.catch(function (err) {
				cli.error(err);
			})
		;
	});
}).call(this);