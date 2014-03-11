#! /bin/bash

# remove old dists
rm -r dist

# use empty settings file for dist build
mv timagic_settings.xml timagic_settings_user.xml
mv timagic_settings_empty.xml timagic_settings.xml

# build with pyinstaller
pyinstaller timagic.spec

# zip the newly build dists
zip dist/timagic_console.zip timagic_console.py timagic_settings.xml
zip dist/timagic_one_folder.zip dist/timagic
zip dist/timagic_app.zip dist/timagic.app

# remove the build folder
rm -r build dist/timagic dist/timagic.app

# re-enable the user settings file
mv timagic_settings.xml timagic_settings_empty.xml
mv timagic_settings_user.xml timagic_settings.xml
