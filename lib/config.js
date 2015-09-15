var config = {
	/**
	 * CONFIGURE ADB PATH
	 */
	"adb_path": "/Applications/android-sdk-macosx/platform-tools/adb",

	/**
	 * CONFIGURE ANDROID BUILD
	 */
	"keystore_path": "KEYSTORE_PATH",
	"keystore_alias": "KEYSTORE_ALIAS",
	"keystore_pw": "KEYSTORE_PASSWORD",
	// "apk_output_path": "",

	/**
	 * CONFIGURE IOS BUILD
	 */
	"distribution_name": "DISTRIBUTION_NAME",
	"pp_uuid": "PP_UUID",
	// "ipa_output_path": "",

	/**
	 * CONFIGURE DISTRIBUTION
	 */
	"distribution_base_url": "https://YOUR.FILESERVER.COM/",
	// "distribution_path": "",
};

module.exports = config;