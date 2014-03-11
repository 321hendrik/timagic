#!/usr/bin python
__appname__ = "TiMagic"
__author__	  = "Hendrik Elsner"
__copyright__   = "Copyleft 2013"
__email__ = "321hendrik@gmail.com"
__version__ = "1.7"

''' Imports '''
import os
import subprocess
import xml.dom.minidom as dom
from multiprocessing import Process

def resource_path(relative_path):
	''' Get absolute path to resource, works for dev and for PyInstaller '''
	try:
		# PyInstaller creates a temp folder and stores path in _MEIPASS
		base_path = getattr(sys, '_MEIPASS', os.getcwd())
	except Exception:
		base_path = os.path.abspath(".")

	return os.path.join(base_path, relative_path)

def get_from_xml(xml_path, key):
	''' get value for a key from an xml file '''
	# get the value for a key from an xml-file
	xml_tree = dom.parse(xml_path)
	value = 'none'
	for node in xml_tree.firstChild.childNodes:
		if node.nodeName == key: 
			value = node.firstChild.data.strip()
	return value
	
## read basic location from xml file
config_xml_path = resource_path('timagic_settings.xml')
user_dir = get_from_xml(config_xml_path, 'user_dir')
titanium_workspace_path = get_from_xml(config_xml_path, 'titanium_workspace_path')
adb_path = get_from_xml(config_xml_path, 'adb_path')
# android
apk_output_path = get_from_xml(config_xml_path, 'apk_output_path')
keystore_path = get_from_xml(config_xml_path, 'keystore_path')
keystore_alias = get_from_xml(config_xml_path, 'keystore_alias')
keystore_pw = get_from_xml(config_xml_path, 'keystore_pw')
# iOS
ipa_output_path = get_from_xml(config_xml_path, 'ipa_output_path')
distribution_name = get_from_xml(config_xml_path, 'distribution_name')
pp_uuid = get_from_xml(config_xml_path, 'pp_uuid')

def remove_and_install(project_name, app_id, app_name, adb_path, titanium_workspace_path, device_id, sdk_version):
	''' remove and/or install an APK to an android device '''
	# install an apk to all connected adb devices and remove the old version if necessary
	print ('...trying to uninstall old APK from ' + device_id)
	uninstall_command = adb_path + ' -s ' + device_id + ' uninstall ' + app_id
	os.system(uninstall_command)
	print ('...trying to install new APK to ' + device_id)
	apk_path = titanium_workspace_path + project_name +'/build/android/bin/' + (app_name if float(sdk_version[0:3]) >= 3.2 else 'app') + '.apk'
	install_command = adb_path + ' -s ' + device_id + ' install ' + apk_path
	os.system(install_command)
	start_app_command = adb_path + ' -s ' + device_id + ' shell am start -n ' + app_id + '/' + app_id + '.' + app_name + 'Activity'
	os.system(start_app_command)

############ qt-gui

import sys
import platform
import PySide

from PySide.QtCore import *
from PySide.QtGui import *
from ui_timagic import Ui_MainWindow

class MainWindow(QMainWindow, Ui_MainWindow):
	def __init__(self, parent=None):
		''' do on class construction '''
		super(MainWindow, self).__init__(parent)
		self.setupUi(self)
		
		# About Action
		self.actionAbout = QAction('About', self)
		self.actionAbout.triggered.connect(self.about_box)
		self.menuAPK_IPA_Magic.addAction(self.actionAbout)
		
		# Connect ui-elements to functions
		self.actionRun_current_Configuration.triggered.connect(self.run)
		self.btnRun.clicked.connect(self.run)
		self.btnReloadProjects.clicked.connect(self.reload_projects)
		self.btnReloadDeviceCount.clicked.connect(self.reload_devices)
		
		# Initial Setup
		self.radioBtnAndroidDevices.setChecked(True)
		self.reload_projects()
		self.reload_devices()
		self.set_run_lock(False)
		
	def set_run_lock(self, bool):
		self.run_lock = bool
		self.btnRun
		
	def reload_devices(self):
		''' reload device_list and show device count '''
		self.device_list = subprocess.check_output(adb_path + ' devices | grep device', shell=True).replace('\tdevice','').split('\n')[1:-1]
		self.labelDeviceCount.setText(str(len(self.device_list)))
	
	def reload_projects(self):
		''' reload project_names list and show in projects area '''
		self.deviceListWidget.clear()
		
		self.project_names = []
		for elem in os.listdir(titanium_workspace_path):
			if elem[0].isalpha() and elem[-4].isalpha():
				self.project_names.append(elem)
		
		items_list = []
		for i in self.project_names:
			items_list.append(QListWidgetItem(i, self.deviceListWidget))
		if len(items_list) > 0:
			self.deviceListWidget.setCurrentItem(items_list[0])
			
	def run(self):
		''' handle run depending on user's settings '''
		self.reload_devices()
		if not self.run_lock:
			self.set_run_lock(True)
			# Which project?
			project_name = self.deviceListWidget.currentItem().text()
		
			# Which target?
			if self.radioBtnAndroidDevices.isChecked():
				target = 'devices'
			elif self.radioBtnAPK.isChecked():
				target = 'apk'
			elif self.radioBtnIPA.isChecked():
				target = 'ipa'
				# iOS Version?
				if self.radioBtnIOS6.isChecked():
					iOSVersion = '6.1'
				elif self.radioBtnIOS7.isChecked():
					iOSVersion = '7.0'
		
			iOSVersion = '7.0'
			tiapp_xml_path = titanium_workspace_path + project_name + '/tiapp.xml'
			sdk_version = get_from_xml(tiapp_xml_path, 'sdk-version')
			app_id = get_from_xml(tiapp_xml_path, 'id')
			app_name = get_from_xml(tiapp_xml_path, 'name').replace(' ', '')
		
			if target == 'devices':
				if len(self.device_list) > 0:
					# default build and install to all android devices
					self.print_to_log('building APK\n')
					build_test_apk_command = 'titanium build -b -s "' + sdk_version + '" -p "android" -d ' + titanium_workspace_path + project_name
					os.system(build_test_apk_command)

					# install the apk to all connected devices
					self.print_to_log('installing ' + project_name + ' APK to all devices...\n')
					d = {}
					for i in self.device_list:
						d[i] = Process(target=remove_and_install, args=(project_name, app_id, app_name, adb_path, titanium_workspace_path, i, sdk_version))
						d[i].start()
					for i in self.device_list:
						d[i].join()
						self.print_to_log('Done\n')
						self.set_run_lock(False)
				else:
					self.print_to_log('Please connect a device first.\n') 
				
			elif target == 'ipa':
				# build ad-hoc IPA for given iOS-version (e.g. for project number 1 and iOS-version 7.0 --> 1ipa7.0)
				self.print_to_log('Building Ad-Hoc IPA...\n')
				build_ipa_command = 'titanium build -d '+ titanium_workspace_path + project_name +' -p ios -s ' + sdk_version + ' -R ' + distribution_name
				build_ipa_command += ' -I ' + iOSVersion + ' -P ' + pp_uuid + ' -O ' + ipa_output_path + ' -T dist-adhoc'
				os.system(build_ipa_command)
				self.print_to_log('Done\n')
				self.set_run_lock(False)
				
			elif target == 'apk':
				# build Play-Store APK (e.g. for project number 1 --> 1apk)
				self.print_to_log('Building APK for Google Play Store...\n')
				build_apk_command = 'titanium build -s "' + sdk_version + '" -p android -d ' + titanium_workspace_path + project_name
				build_apk_command += ' -K ' + keystore_path + ' -L ' + keystore_alias + ' ' + ('--store-password' if float(sdk_version[0:3]) >= 3.2 else '--password') + ' ' + keystore_pw
				build_apk_command += ' -O ' + apk_output_path + ' -T dist-playstore'
				os.system(build_apk_command)
				self.print_to_log('Done\n')
				self.set_run_lock(False)
			else:
				self.set_run_lock(False)
		
	def about_box(self):
		''' Display an about box '''
		QMessageBox.about(self, "About APK / IPA Magic",
			"""<b>%s</b> v %s
			<p>%s %s.
			 <p>Python %s -  PySide version %s - Qt version %s on %s""" % (__appname__, __version__, __copyright__, __author__, platform.python_version(), PySide.__version__,  PySide.QtCore.__version__, platform.system()))
			
	def print_to_log(self, text):
		''' print text to the console output area '''
		self.consoleLogTextEdit.insertPlainText(text)
		self.consoleLogTextEdit.ensureCursorVisible()
		

if __name__ == '__main__':
	# app
	app = QApplication(sys.argv)
	frame = MainWindow()
	frame.show()
	app.exec_()
	sys.exit()