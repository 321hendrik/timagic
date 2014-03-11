TiMagic
=======
A Simple UI for automation of the Titanium CLI and ADB

To run the precompiled App you need Mac OS X 10.6+ (Because of 64-bit Python).

Get TiMagic
-----------
* Get the command-line version /dist/timagic_console.zip [recommended]

* Get the Mac App from /dist/timagic_app.zip

* Get the one folder executable from /dist/timagic_one_folder.zip

Setup your Paths
----------------
* Console-Version: Edit timagic_settings.xml
* App-Version: Right click on timagic.app and choose "Show Contents". Edit Contents/MacOS/timagic_settings.xml.
* Folder-Version: Edit timagic/timagic_settings.xml

General Requirements
--------------------
* Python 2.7 http://www.python.org/download/releases/2.7/
* Titanium CLI <= 3.2
* ADB 1.0.*

Installing IPA to iOS Device
------------------------------
For this feature to work, you need to install libimobiledevice-macosx following the installation guide at https://github.com/benvium/libimobiledevice-macosx

Building from Source
--------------------
Requirements:
* Python 2.7 http://www.python.org/download/releases/2.7/
* PyInstaller 2.1 https://pypi.python.org/pypi/PyInstaller/2.1

Additional requirements for the GUI version:
* Qt 4.7.4 http://download.qt-project.org/archive/qt/4.7/
* PySide 1.1.0 http://qt-project.org/wiki/Get-PySide

If you edited timagic.ui, create a python module from it by running `pyside-uic timagic.ui > ui_timagic.py`
If you used additional resources, add them to timagic.spec

To build and package run `./build.sh`