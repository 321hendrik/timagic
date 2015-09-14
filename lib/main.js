(function () {
	var cli = require('cli').enable('version');

	var Q = require('q');

	var logic = require('./logic');

	cli.setApp('TiMagic', '0.0.3');

	commandOptions = cli.parse({
		test: ['t', 'run app test']
	});

	cli.main(function(args, options) {
		console.log('args', args);
		console.log('options', options);

		if (args.indexOf('test') > -1) {
			// show spinner
			cli.spinner('Testing...');
			// clone base repository
			logic.test({})
				.then(function (data) {
					cli.spinner('Testing...done!', true);
					cli.ok('Success');
					cli.debug(data);
				})
				.catch(function (err) {
					cli.spinner('Testing...failed!', true)
					cli.debug('error', err);
				})
			;
		}
	});
}).call(this);