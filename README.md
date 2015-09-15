# TiMagic (NodeJS)
![*Screenshot here*](screenshot.png)  
Command-line tool for the Titanium CLI and ADB, which bundles the following features:

* Build and install in parallel to all connected android devices and genymotion or run in iOS simulator.
* Quickly install prebuild apps to all connected android devices.
* All build related information is pulled from a one-time config file and the project's tiapp.xml.
* Use your favourite IDE for app development without sacrificing easy and fast access to Titanium CLI features.
* Distribute your app to iOS and android devices using a generated microsite

### Get TiMagic
1. Clone the repository to a local folder.
1. Setup your paths and configuration in lib/config.js
1. Fetch Dependencies with ```npm install```
1. Link for global access to the CLI
(Assuming you're on the repository's root folder) run:  
```npm link```

### Use TiMagic
Run `timagic -h` for usage information.

### General Requirements
* NodeJS & NPM
* Currently only tested on MacOS
* [Appcelerator Titanium CLI](https://github.com/appcelerator/titanium) <= 3.2
* ADB 1.0.* (As part of Appcelerator Titanium)