#!/usr/bin python
__author__      = "Hendrik Elsner"
__copyright__   = "Copyleft 2013"
__email__ = "321hendrik@gmail.com"
__version__ = "2.0"


import os, sys, subprocess
import xml.dom.minidom as dom
from multiprocessing import Process

def shell_exec(arg):
	''' takes a string or list of shell commands and executes it '''
	command = ''
	if type(arg) is list:
		command = ' '.join(arg)
	elif type(arg) is str:
		command = arg
	os.system(command);

def color(color_string, string):
	colors = {
		'yellow' : '\033[93m',
		'red': '\033[91m',
		'green': '\033[92m',
		'blue': '\033[94m',
		'aqua': '\033[96m',
		'end': '\033[0m'
	}
	return colors[color_string] + string + colors['end']

def get_project_names():
	''' gets all project names from given workspace '''
	project_names = []
	for elem in os.listdir(settings['titanium_workspace_path']):
		if os.path.isdir(settings['titanium_workspace_path'] + elem) and ('tiapp.xml' in os.listdir(settings['titanium_workspace_path'] + elem)):
			project_names.append(elem)
	return project_names

def get_from_xml(xml_path, key):
	''' get the value for a key from an xml-file '''
	xml_tree = dom.parse(xml_path)
	value = 'none'
	for node in xml_tree.firstChild.childNodes:
		if node.nodeName == key:
			value = node.firstChild.data.strip()
	return value

def remove_apk(**kwargs):
	print '...trying to uninstall APK from ' + kwargs['device_id']
	shell_exec([settings['adb_path'], '-s', kwargs['device_id'], 'uninstall', kwargs['app_id']])

def install_apk(**kwargs):
	print '...trying to install APK to ' + kwargs['device_id']
	shell_exec([settings['adb_path'], '-s', kwargs['device_id'], 'install', kwargs['apk_path']])

def start_app_activity(**kwargs):
	print '...trying to launch Activity on ' + kwargs['device_id']
	shell_exec([settings['adb_path'], '-s', kwargs['device_id'], 'shell', 'am', 'start', '-n', (kwargs['app_id'] + '/' + kwargs['app_id'] + '.' + kwargs['app_name_no_spaces'] + 'Activity')])

def deploy_apk(**kwargs):
	''' installs an apk to all connected adb devices and removes the old version if necessary '''
	remove_apk(device_id=kwargs['device_id'],app_id=kwargs['app_id'])
	install_apk(device_id=kwargs['device_id'], apk_path=kwargs['apk_path'])
	start_app_activity(device_id=kwargs['device_id'], app_id=kwargs['app_id'], app_name_no_spaces=kwargs['app_name_no_spaces'])

def deploy_ipa(**kwargs):
	print '...trying to install IPA to ' + kwargs['device_id']
	shell_exec(['ideviceinstaller', '-U', kwargs['device_id'], '-i', kwargs['ipa_path']])

def remove_ipa(**kwargs):
	print '...trying to uninstall IPA from ' + kwargs['device_id']
	shell_exec(['ideviceinstaller', '-U', kwargs['device_id'], '-u', kwargs['app_id']])

def print_ui():
	''' prints out the ui '''
	shell_exec('clear')
	print color('aqua', '-'*20 + '= TiMagic '+__version__+' =' + '-'*20)
	for i in range(len(projects)):
		print color('green', str(i)) + ' < ' + projects[i]
	print color('yellow', 'h < show help')
	print color('red', 'x < exit')
	print notification

def print_help():
	''' prints out the help '''
	shell_exec('clear')
	print ''
	print color('yellow', '-'*20 + '= TiMagic HELP ' + '=' + '-'*20)
	if not has_libimobiledevice:
		print '! To unlock additional features install https://github.com/benvium/libimobiledevice-macosx !'
	print ''
	print color('yellow', 'project number is represented by *')
	print ''
	print ' Common ' + '-'*60
	if has_libimobiledevice:
		print color('green','*') + ' | ' + color('green','*build') + '[IOS_VERSION]' + ('\t'*2) + ': installs to all connected devices'
	else:
		print color('green','*') + ('\t'*4) + ': installs to all connected android devices'
	print '*' + color('green','remove') + ('\t'*4) + ': removes the app from all connected ' + ('' if has_libimobiledevice else 'android ') + 'devices'
	print '*' + color('green','clean') + ('\t'*4) + ": cleans the project's build directory"
	print ''
	print ' Android ' + '-'*60
	print '*' + color('green','apk') + ('\t'*4) +': creates a signed APK'
	print '*' + color('green','todevice') + ('\t'*3) + ': installs signed APK from previous build to all connected android devices'
	print '*' + color('green','todeviceU') + ('\t'*3) + ': installs unsigned APK from previous build to all connected android devices'
	print ''
	print ' iOS ' + '-'*60
	print '*' + color('green','iphone') + ' | ' + color('green','ipad') + '[IOS_VERSION]' + ('\t'*1) + ': launches the iphone or ipad simulator for the given project'
	print '*' + color('green','ipa') + '[IOS_VERSION]' + ('\t'*2) + ': creates an ad-hoc IPA'
	if has_libimobiledevice:
		print '*' + color('green','todevice') + ('\t'*3) + ': installs ad-hoc IPA from previous build to all connected iOS devices'
	print '\n\n'

# global vars
last_choice = ''
script_path = '/'.join(sys.argv[0].split('/')[0:-1]) + '/'

# get settings from settings file
config_xml_path = script_path + 'timagic_settings.xml'
settings = {
	'user_dir': '',
	'titanium_workspace_path': '',
	'adb_path': '',
	'apk_output_path': '',
	'keystore_path': '',
	'keystore_alias': '',
	'keystore_pw': '',
	'ipa_output_path': '',
	'distribution_name': '',
	'pp_uuid': ''

}
for elem in settings:
	settings[elem] = get_from_xml(config_xml_path, elem)

# UI variables
answer = -1
notification = '\n'
projects = get_project_names()

# check if libimobiledevice is installed
has_libimobiledevice = False
try:
	subprocess.call('idevice_id', stdout=subprocess.PIPE)
	has_libimobiledevice = True
except:
	print 'libimobiledevice is not installed...'

# UI-loop
while True:
	# print the ui
	print_ui()
	user_input = raw_input(last_choice + ' > ')
	project_num = ''
	ios_version = ''

	# print help
	if str(user_input) == 'h':
		print_help()
		raw_input('press enter to close help...')
		continue

	# repeat last choice?
	if str(user_input) == '' and str(last_choice) != '':
		user_input = last_choice
	# set last_choice from current and strip clean
	last_choice = user_input.replace('clean', '')

	# handle user-input
	input_params = ''
	for i in str(user_input):
		if i == 'x':
			break
		elif i in '0123456789.':
			if len(input_params) > 0:
				ios_version += i
			else:
				project_num += i
		else: input_params += i
	if str(user_input)[0] == 'x':
		shell_exec('clear')
		break
	project_num = int(project_num)

	# check if project's number is valid
	if project_num < len(projects) and project_num >= 0 :
		shell_exec('clear')

		# get build parameters
		project_name = projects[project_num]
		tiapp_xml_path = settings['titanium_workspace_path'] + project_name + '/tiapp.xml'
		sdk_version = get_from_xml(tiapp_xml_path, 'sdk-version')
		app_id = get_from_xml(tiapp_xml_path, 'id')
		app_name = get_from_xml(tiapp_xml_path, 'name')
		app_name_escaped_spaces = app_name.replace(' ', '\ ')
		app_name_no_spaces = app_name.replace(' ', '');
		ios_version = ios_version or '7.0' # default to iOS-version 7.0
		app_path = settings['titanium_workspace_path'] + project_name

		# get lists of connected devices
		android_device_list = subprocess.check_output(settings['adb_path'] + ' devices | grep device', shell=True).replace('\tdevice','').split('\n')[1:-1]
		ios_device_list = subprocess.check_output('idevice_id -l', shell=True).split('\n')[0:-1] if has_libimobiledevice else []

		# base titanium cli command
		base_command = ['titanium', 'build', '-d', app_path, '-s', sdk_version]

		if input_params in ['', 'build', 'todevice', 'todeviceU', 'remove']:

			android_connected = True if len(android_device_list) else False
			ios_connected = True if len(ios_device_list) else False

			if android_connected or ios_connected:
				if input_params in ['', 'build']:
					build_processes = {}
					if android_connected:
						# default build for android devices
						print 'building unsigned APK'
						build_command_apk = base_command + ['-p', 'android', '-b']
						build_processes['android'] = Process( target=shell_exec, args=(build_command_apk,) )

					if ios_connected:
						# default build for ios devices
						print 'building ad-hoc IPA'
						build_command_ipa = base_command + ['-p', 'ios', '-R', settings['distribution_name'], '-I', ios_version, '-P', settings['pp_uuid'], '-O', settings['ipa_output_path'], '-T', 'dist-adhoc']
						build_processes['ios'] = Process( target=shell_exec, args=(build_command_ipa,) )

					# start parallel builds and wait for them to finish
					for platform in build_processes:
						build_processes[platform].start()
						build_processes[platform].join()


				# install to connected devices
				if android_connected:
					# get app path
					if input_params == 'todevice':
						apk_path = settings['apk_output_path'] + app_name_escaped_spaces + '.apk'
					else:
						apk_path = app_path +'/build/android/bin/' + (app_name_no_spaces if float(sdk_version[0:3]) >= 3.2 else 'app') + '.apk'

					android_kwargs = { 'app_id': app_id }

				if ios_connected:
					# get app path
					ipa_path = settings['ipa_output_path'] + app_name_escaped_spaces + '.ipa'
					ios_kwargs = {}

				# remove or install
				if input_params == 'remove':
					operation = 'removing from'

					android_target = remove_apk

					ios_target = remove_ipa
					ios_kwargs['app_id'] = app_id
				else:
					operation = 'installing to'

					android_target = deploy_apk
					android_kwargs['apk_path'] = apk_path
					android_kwargs['app_name_no_spaces'] = app_name_no_spaces

					ios_target = deploy_ipa
					ios_kwargs['ipa_path'] = ipa_path

				parallel_install_processes = {}
				# install the apk to all connected android devices
				print project_name + ' ' + operation + ' all android devices...'
				for device_id in android_device_list:
					android_kwargs['device_id'] = device_id
					parallel_install_processes[device_id] = Process(target=android_target, kwargs=android_kwargs)
					parallel_install_processes[device_id].start()

				# install the ipa to all connected ios devices
				print project_name + ' ' + operation + ' all iOS devices...'
				for device_id in ios_device_list:
					ios_kwargs['device_id'] = device_id
					parallel_install_processes[device_id] = Process(target=ios_target, kwargs=ios_kwargs)
					parallel_install_processes[device_id].start()

				# wait for parallel installation processes to finish
				for device_id in parallel_install_processes:
					parallel_install_processes[device_id].join()

			else:
				notification =  color('red', '\n --> Please connect a device first.\n')

		elif input_params == 'clean':
			shell_exec(['titanium', 'clean', '-d', app_path])

		elif input_params == 'ipa':
			# build ad-hoc IPA for given iOS-version (e.g. for project number 1 and iOS-version 7.0 --> 1ipa7.0)
			shell_exec(base_command + ['-p', 'ios', '-R', settings['distribution_name'], '-I', ios_version, '-P', settings['pp_uuid'], '-O', settings['ipa_output_path'], '-T', 'dist-adhoc'])

		elif input_params == 'ipad' or input_params == 'iphone':
			# Install to and launch given iOS-Simulator (e.g. for project number 1 and iOS-version 7.0 --> 1ipad7.0 or 1iphone7.0)
			shell_exec(base_command + ['-p', 'ios', '-I', ios_version, '-Y', input_params, '-S', ios_version, '-T', 'simulator'])

		elif input_params == 'apk':
			# build Play-Store APK (e.g. for project number 1 --> 1apk)
			password_flag = ('--store-password' if float(sdk_version[0:3]) >= 3.2 else '--password')
			shell_exec(base_command + ['-p', 'android', '-K', settings['keystore_path'], '-L', settings['keystore_alias'], password_flag, settings['keystore_pw'], '-O', settings['apk_output_path'], '-T', 'dist-playstore'])

		#shell_exec('osascript -e \'tell app "System Events" to display dialog "APK successfully installed to all connected devices."\'') # popup on complete
	else:
		notification = color('red', '\n --> input out of range please enter valid numbers only\n')