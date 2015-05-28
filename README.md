# TiMagic
![*Screenshot here*](screenshot.png)  
Command-line tool for the Titanium CLI and ADB, which bundles the following features:

* Build and install in parallel to all connected android devices and genymotion or run in iOS simulator.
* Quickly install prebuild apps to all connected android devices.
* All build related information is pulled from a one-time config file (xml) and the project's tiapp.xml.
* Use your favourite IDE for app development without sacrificing easy and fast access to Titanium CLI features.
* Distribute your app to iOS and android devices using a generated microsite (beta feature)

### Get TiMagic
1. Clone the repository to a local folder.
1. Setup your paths and configuration in timagic_settings_empty.xml and rename it to timagic_settings.xml
1. Simlink the files to a folder in your PATH
(Assuming your on the repositories root folder and `~/bin` is in your PATH) run:  
```ln timagic ~/bin/timagic;ln timagic_settings.xml ~/bin/timagic_settings.xml;chmod +x ~/bin/timagic```

### Use TiMagic
There are two interfaces you can use.
#### With Parameters (from your app projects directory)
Run `timagic help` for usage information.
#### Without Parameters (anywhere)
Run `timagic` and choose an option from the UI

### General Requirements
* Currently only tested on MacOS
* [Python 2.7](http://www.python.org/download/releases/2.7/)
* [Appcelerator Titanium CLI](https://github.com/appcelerator/titanium) <= 3.2
* ADB 1.0.* (As part of Appcelerator Titanium)

## Additional Functionality
### Microsite Distribution
To distribute your app (ad-hoc ipa, apk) from a microsite your need the python [qrcode module](https://github.com/lincolnloop/python-qrcode) and some webspace.