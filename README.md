# TiMagic
Command-line tool for the Titanium CLI and ADB, which bundles the following features:

* Build and install (apk, ipa) in parallel to all connected devices and genymotion. (as iOS 8.1 broke libimobiledevice this feature is android only)
* Quickly install prebuild apps to all connected devices without iTunes, xCode Organizer or adb-monitor.
* All build related information is pulled from a one-time config file (xml) and the project's tiapp.xml.
* Run an app in iOS-Simulator (optionally with a specific iOS-version).
* Distribute your app to iOS and android devices using a generated microsite (beta feature)
* Remove an app from all connected devices
* Use your favourite IDE for app development without sacrificing easy and fast access to Titanium CLI features.

### Get TiMagic
Clone the repository to a local folder.

### Setup your Paths
* Console-Version: Edit timagic_settings.xml

### General Requirements
* Currently only tested on MacOS
* [Python 2.7](http://www.python.org/download/releases/2.7/)
* [Appcelerator Titanium CLI](https://github.com/appcelerator/titanium) <= 3.2
* ADB 1.0.* (As part of Appcelerator Titanium)

## Additional Functionality
### iOS device features (currently not possible because iOS 8.1 broke libimobiledevice)
To use iOS device, you need to install [libimobiledevice-macosx](https://github.com/benvium/libimobiledevice-macosx).

### Microsite Distribution
To distribute your app (ad-hoc ipa, apk) from a microsite your need the python [qrcode module](https://github.com/lincolnloop/python-qrcode) and some webspace.