# TiMagic
A Simple UI for automation of the Titanium CLI and ADB, which bundles the following features:

* Build and install (apk, ipa) in parallel to all connected devices and genymotion.
* Quickly install prebuild apps to all connected devices without iTunes, xCode Organizer or adb-monitor.
* All build related information is pulled from a one-time config file (xml) and the project's tiapp.xml.
* Run an app in iOS-Simulator (optionally with a specific iOS-version).
* Remove an app from all connected devices
* Use your favourite IDE for app development without sacrificing easy and fast access to Titanium CLI features.

### Get TiMagic
* Python script: /dist/timagic_console.zip [ recommended ]
* Mac App (Alpha): /dist/timagic_app.zip [ Mac OS X 10.6+ (Because of 64-bit Python) ]

### Setup your Paths
* Console-Version: Edit timagic_settings.xml
* App-Version: Right click on timagic.app and choose "Show Contents". Edit Contents/MacOS/timagic_settings.xml.
* Folder-Version: Edit timagic/timagic_settings.xml

### General Requirements
* Currently only tested on MacOS
* Python 2.7 http://www.python.org/download/releases/2.7/
* Titanium CLI <= 3.2
* ADB 1.0.*

### iOS device features
For those to work, you need to install libimobiledevice-macosx following the installation guide at https://github.com/benvium/libimobiledevice-macosx

## Building the GUI version from source
### Requirements:
* Python 2.7 http://www.python.org/download/releases/2.7/
* PyInstaller 2.1 https://pypi.python.org/pypi/PyInstaller/2.1

###A dditional requirements for the GUI version:
* Qt 4.7.4 http://download.qt-project.org/archive/qt/4.7/
* PySide 1.1.0 http://qt-project.org/wiki/Get-PySide

If you edited timagic.ui, create a python module from it by running `pyside-uic timagic.ui > ui_timagic.py`
If you used additional resources, add them to timagic.spec

To build and package run `./build.sh`