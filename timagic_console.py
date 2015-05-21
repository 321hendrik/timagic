#!/usr/bin python
__author__      = "Hendrik Elsner"
__copyright__   = "Copyleft 2015"
__email__ = "321hendrik@gmail.com"
__version__ = "2.3"

import os, sys, subprocess, datetime, readline

readline.parse_and_bind('tab: complete')
readline.parse_and_bind('set editing-mode vi')

try:
    import qrcode
    qrcode_available = True
except:
    qrcode_available = False

import xml.dom.minidom as dom
from multiprocessing import Process

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
    'pp_uuid': '',
    'distribution_path': '',
    'distribution_base_url': '',
    'latest_ios_version': ''
}

def shell_exec(arg):
    ''' takes a 'string' or list of shell commands and executes it '''
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

def get_datecode():
    ''' get the number of the current day '''
    return datetime.date.today().timetuple().tm_yday

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
    shell_exec([settings['adb_path'], '-s', kwargs['device_id'], 'install', '-r', kwargs['apk_path']])

def start_app_activity(**kwargs):
    print '...trying to launch Activity on ' + kwargs['device_id']
    # form activity name
    activity_name = kwargs['app_name_no_spaces'].lower().title()
    shell_exec([settings['adb_path'], '-s', kwargs['device_id'], 'shell', 'am', 'start', '-n', (kwargs['app_id'] + '/' + kwargs['app_id'] + '.' + activity_name + 'Activity')])

def deploy_apk(**kwargs):
    ''' installs an apk to all connected adb devices and removes the old version if necessary '''
    install_apk(device_id=kwargs['device_id'], apk_path=kwargs['apk_path'])
    start_app_activity(device_id=kwargs['device_id'], app_id=kwargs['app_id'], app_name_no_spaces=kwargs['app_name_no_spaces'])

def deploy_ipa(**kwargs):
    print '...trying to install IPA to ' + kwargs['device_id']
    shell_exec(['ideviceinstaller', '-U', kwargs['device_id'], '-i', kwargs['ipa_path']])

def remove_ipa(**kwargs):
    print '...trying to uninstall IPA from ' + kwargs['device_id']
    shell_exec(['ideviceinstaller', '-U', kwargs['device_id'], '-u', kwargs['app_id']])

def print_ui(projects, notification):
    ''' prints out the ui '''
    shell_exec('clear')
    print color('aqua', '-'*20 + '= TiMagic '+__version__+' =' + '-'*20)
    for i in range(len(projects)):
        print color('green', str(i)) + ' < ' + projects[i]
    print color('yellow', 'h < show help')
    print color('red', 'x < exit')
    print notification

def print_help(has_libimobiledevice):
    ''' prints out the help '''
    shell_exec('clear')
    print ''
    print color('green', 'TiMagic v' +__version__) + ' created by ' + __author__ + ' (' + __email__ + ')' + ' ' + __copyright__
    if not has_libimobiledevice:
        print '! To unlock additional features install https://github.com/benvium/libimobiledevice-macosx !'
    print ''
    print color('yellow', 'project number is represented by *')
    print ''
    print ' Common ' + '-'*60
    if has_libimobiledevice:
        print color('green','*') + ' | ' + '*' + color('green','build') + '[IOS_VERSION]' + ('\t'*2) + ': installs to all connected devices'
    else:
        print color('green','*') + ('\t'*4) + ': installs to all connected android devices'
    if qrcode_available:
        print '*' + color('green','dist') + ' | ' + '*' +  color('green','distbuild') + ('\t'*2) + ': generates files for microsite distribution (and APK/IPA with "build")'
    print '*' + color('green','remove') + ('\t'*4) + ': removes the app from all connected ' + ('' if has_libimobiledevice else 'android ') + 'devices'
    print '*' + color('green','clean') + ('\t'*4) + ": cleans the project's build directory"
    print ''
    print ' Android ' + '-'*60
    print '*' + color('green','apk') + ('\t'*4) +': creates a signed APK'
    print '*' + color('green','todevice') + ('\t'*3) + ': installs signed APK from previous build to all connected android devices'
    print '*' + color('green','todeviceU') + ('\t'*3) + ': installs unsigned APK from previous build to all connected android devices'
    print ''
    print ' iOS ' + '-'*60
    print '*' + color('green','iphone') + ' | ' + '*' + color('green','ipad') + '[IOS_VERSION]' + ('\t'*1) + ': launches the iphone or ipad simulator for the given project'
    print '*' + color('green','ipa') + '[IOS_VERSION]' + ('\t'*2) + ': creates an ad-hoc IPA'
    if has_libimobiledevice:
        print '*' + color('green','todevice') + ('\t'*3) + ': installs ad-hoc IPA from previous build to all connected iOS devices'
    if (not has_libimobiledevice) or (not qrcode_available):
        print ''
        print color('red', 'You can unlock additional functionality by installing these dependencies: ' + ('libimobiledevice' if not has_libimobiledevice else '') + (', ' if ((not has_libimobiledevice) and (not qrcode_available)) else '') + ('qrcode for python' if not qrcode_available else ''))
        print color('red', 'For installation instructions visit https://github.com/hendrikelsner/timagic')
        print ''
    else:
        print '\n\n'

def print_version_and_info():
    print color('green', 'TiMagic v' +__version__) + ' created by ' + __author__ + ' (' + __email__ + ')' + ' ' + __copyright__

def print_available_projects(projects):
    ''' prints out all available projects '''
    shell_exec('clear')
    project_list = ''
    for i in range(len(projects)):
        project_list += (projects[i] + ' | ')
    print color('green', project_list[:-3])

def print_cli_help(has_libimobiledevice):
    ''' prints the cli help '''
    shell_exec('clear')
    print color('green', 'TiMagic v' +__version__) + ' created by ' + __author__ + ' (' + __email__ + ')' + ' ' + __copyright__
    if not has_libimobiledevice:
        print '! To unlock additional features install https://github.com/benvium/libimobiledevice-macosx !'
    print ''
    print color('yellow', 'usage: magic ([project_id]) ([action]) ([ios_version])') + ' ' + color('green', 'running without parameters will launch a console gui version')
    print ''
    print ' General Actions - no [project_id] needed ' + '-'*60
    print color('green','list') + ('\t'*6) + ": lists available project ids"
    print ''
    print ' General Actions ' + '-'*60
    print '[project_id] ' + color('green','(build)') + ' ([ios_version])' + ('\t'*2) + ': installs to all connected devices'
    print '[project_id] ' + color('green','remove') + ('\t'*4) + ': removes the app from all connected ' + ('' if has_libimobiledevice else 'android ') + 'devices'
    print '[project_id] ' + color('green','clean') + ('\t'*4) + ": cleans the project's build directory"
    print ''
    print ' Android Actions ' + '-'*60
    print '[project_id] ' + color('green','apk') + ('\t'*4) +': creates a signed APK'
    print '[project_id] ' + color('green','todevice') + ('\t'*4) + ': installs signed APK from previous build to all connected android devices'
    print '[project_id] ' + color('green','todeviceU') + ('\t'*4) + ': installs unsigned APK from previous build to all connected android devices'
    print ''
    print ' iOS Actions ' + '-'*60
    print '[project_id] ' + color('green','iphone') + ' | ' + color('green','ipad') + ' [ios_version]' + ('\t'*1) + ': launches the iphone or ipad simulator for the given project'
    print '[project_id] ' + color('green','ipa') + ' [ios_version]' + ('\t'*3) + ': creates an ad-hoc IPA'
    if (not has_libimobiledevice) or (not qrcode_available):
        print ''
        print color('red', 'You can unlock additional functionality by installing these dependencies: ' + ('libimobiledevice' if not has_libimobiledevice else '') + (', ' if ((not has_libimobiledevice) and (not qrcode_available)) else '') + ('qrcode for python' if not qrcode_available else ''))
        print color('red', 'For installation instructions visit https://github.com/hendrikelsner/timagic')
        print ''
    else:
        print '\n\n'

def generate_plist(params):
    ''' generates a plist file for use with an app download link '''
    url = params['url'] + params['project_id'] + '/' + params['project_id'] + '-' + params['datecode'] + '.ipa'
    plist = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>items</key><array><dict><key>assets</key><array><dict><key>kind</key><string>software-package</string><key>url</key><string>'
    plist += url + '</string></dict></array><key>metadata</key><dict><key>bundle-identifier</key><string>'
    plist += params['bundle_id'] + '</string><key>bundle-version</key><string>'
    plist += params['bundle_version'] + '</string><key>kind</key><string>software</string><key>title</key><string>'
    plist += params['title'] + '</string></dict></dict></array></dict></plist>'
    with open(params['dist_dir'] + '/manifest.plist', 'w') as f:
        f.write(plist);

def generate_microsite(params):
    ''' generates a microsite displaying devices dependent download links '''
    project_url = params['url'] + params['project_id']
    ios_link = project_url + '/' + 'manifest.plist'
    android_link = project_url + '/' + params['project_id'] + '-' + params['datecode'] + '.apk'

    html = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0"><title>'
    html += params['title'] + '</title><style type="text/css">body {    background: #666;   margin: 0;  padding: 0; font-family: verdana,helvetica,sans-serif;  text-align: center; padding: 10px;  color: #eee;    font-size: 16px;}#container {   width:300px;    margin:0 auto;}h1 { margin:0;   padding:0;  font-size:14px;}p { font-size:13px;}.link { display: none;  background: #555;   border: 1px solid #bbb; margin-top: .5em;   padding: .3em;}.link a {    text-decoration:none;   font-size:15px; display:block;  color:#5bb3eb;}.last_updated {  font-size: x-small; text-align: center; font-style: italic;}.created_with { font-size: x-small; text-align: center;}.created_with a {   color: #aaa;}#no-device-info {  display: none;}</style></head><body><div id="container"><h1>Install Link</h1>'
    html += '<div id="ios-link" class="link"><a href="itms-services://?action=download-manifest&url=' + ios_link + '">Tap Here to Install<br />' + params['title'] + '<br />Directly On Your iOS Device</a></div>'
    html += '<div id="android-link" class="link"><a href="' + android_link + '">Tap Here to Install<br />' + params['title'] + '<br />Directly On Your Android Device</a></div>'
    html += '<div id="no-device-info"><p>Make sure you are visiting this page on your device, not your computer.<br /></p></div>'
    html += '<p class="last_updated">Last Updated: ' + params['date'] + '</p><p class="created_with">'
    if params['show_github_link']:
        html += '<a target="about;blank" href="https://github.com/hendrikelsner/timagic">'
    html += 'Created With TiMagic'
    if params['show_github_link']:
        html += '</a>'
    html += '</p></div>'
    html += '<script type="text/javascript">var device = navigator.userAgent;if ((device.indexOf("iPhone") > -1) || (device.indexOf("iPad") > -1)) {document.getElementById("ios-link").style.display = "block";} else if (device.indexOf("Android") > -1) {document.getElementById("android-link").style.display = "block";} else {document.getElementById("no-device-info").style.display = "block";}</script></body></html>'

    with open(params['dist_dir'] + '/index.html', 'w') as f:
        f.write(html);

def generate_qr_code(params):
    ''' generates a qr code linking to the download page '''
    qr_link = params['url'] + params['project_id'] + '/'
    img = qrcode.make(qr_link)
    file_name = 'qr_link_' + params['project_id'] + '.png'
    with open(params['dist_dir'] + '/' + file_name, 'w') as image_file:
        img.save(image_file,'PNG')

def distribute(project_id, bundle_id, bundle_version, title):
    ''' generates files and folders for microsite distribution and returns the distribution directory '''
    app_info = {
        'url': settings['distribution_base_url'],
        'project_id': project_id,
        'datecode': str(get_datecode()),
        'bundle_id': bundle_id,
        'bundle_version': bundle_version,
        'title': title,
        'show_github_link': False,
        'date': time.strftime('%d.%m.%Y %H:%M Uhr'),
    }

    # create distribute directory for files
    app_info['dist_dir'] = settings['distribution_path'] + 'distribute_' + app_info['project_id']
    if not os.path.exists(app_info['dist_dir']):
        os.makedirs(app_info['dist_dir'])

    # generate files
    generate_plist(app_info)
    generate_microsite(app_info)
    generate_qr_code(app_info)

    return app_info['dist_dir']

def main():
    ''' main ui loop '''
    # global vars
    last_choice = ''
    script_path = '/'.join(sys.argv[0].split('/')[0:-1]) + '/'
    script_path = '' if (len(script_path) == 1) else script_path

    # get settings from settings file
    config_xml_path = script_path + 'timagic_settings.xml'

    for elem in settings:
        settings[elem] = get_from_xml(config_xml_path, elem)

    # UI variables
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
        print_ui(projects, notification)
        user_input = raw_input(last_choice + ' > ')
        project_num = ''
        ios_version = ''
        newest_ios_version = settings['latest_ios_version']

        # print help
        if str(user_input) == 'h':
            print_help(has_libimobiledevice)
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
            app_version = get_from_xml(tiapp_xml_path, 'version')
            app_name = get_from_xml(tiapp_xml_path, 'name')
            app_name_escaped_spaces = app_name.replace(' ', '\ ')
            app_name_no_spaces = app_name.replace(' ', '');
            ios_version = ios_version or newest_ios_version # default to newest iOS-version
            app_path = settings['titanium_workspace_path'] + project_name

            # get lists of connected devices
            android_device_list = subprocess.check_output(settings['adb_path'] + ' devices | grep device', shell=True).replace('\tdevice','').split('\n')[1:-1]

            # libimobiledevice bug @todo
            if has_libimobiledevice:
                ios_device_list = []#subprocess.check_output('idevice_id -l', shell=True).split('\n')[0:-1] if has_libimobiledevice else []
            else:
                ios_device_list = []

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
                            build_command_apk = base_command + ['--platform', 'android', '-b']
                            build_processes['android'] = Process( target=shell_exec, args=(build_command_apk,) )

                        if ios_connected:
                            # default build for ios devices
                            print 'building ad-hoc IPA'
                            build_command_ipa = base_command + ['--platform', 'ios', '-R', settings['distribution_name'], '-I', ios_version, '-P', settings['pp_uuid'], '-O', settings['ipa_output_path'], '-T', 'dist-adhoc']
                            build_processes['ios'] = Process( target=shell_exec, args=(build_command_ipa,) )

                        # start parallel builds and wait for them to finish
                        for platform in build_processes:
                            build_processes[platform].start()
                            build_processes[platform].join()


                    # install to connected devices
                    apk_path = ''
                    android_kwargs = { 'app_id': app_id }
                    if android_connected:
                        # get app path
                        if input_params == 'todevice':
                            apk_path = settings['apk_output_path'] + app_name_escaped_spaces + '.apk'
                        else:
                            apk_path = app_path +'/build/android/bin/' + (app_name_no_spaces if float(sdk_version[0:3]) >= 3.2 else 'app') + '.apk'

                    ipa_path = ''
                    ios_kwargs = {}
                    if ios_connected:
                        # get app path
                        ipa_path = settings['ipa_output_path'] + app_name_escaped_spaces + '.ipa'

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
                # build ad-hoc IPA for given iOS-version
                shell_exec(base_command + ['-p', 'ios', '-R', settings['distribution_name'], '-I', ios_version, '-P', settings['pp_uuid'], '-O', settings['ipa_output_path'], '-T', 'dist-adhoc'])

            elif input_params == 'ipad' or input_params == 'iphone':
                # Install to and launch given iOS-Simulator
                shell_exec(base_command + ['-p', 'ios', '-I', ios_version, '-Y', input_params, '-S', ios_version, '-T', 'simulator'])

            elif input_params == 'apk':
                # build Play-Store APK
                password_flag = ('--store-password' if float(sdk_version[0:3]) >= 3.2 else '--password')
                shell_exec(base_command + ['-p', 'android', '-K', settings['keystore_path'], '-L', settings['keystore_alias'], password_flag, settings['keystore_pw'], '-O', settings['apk_output_path'], '-T', 'dist-playstore'])

            elif (input_params in ['dist', 'distbuild']) and qrcode_available:
                # generate distribution files
                print 'generating files for distribution'
                dist_path = distribute(project_name, app_id, app_version, app_name)

                if input_params == 'distbuild':
                    # build ipa and apk
                    password_flag = ('--store-password' if float(sdk_version[0:3]) >= 3.2 else '--password')
                    apk_build_process = Process(target=shell_exec, args=(base_command + ['-p', 'android', '-K', settings['keystore_path'], '-L', settings['keystore_alias'], password_flag, settings['keystore_pw'], '-O', dist_path, '-T', 'dist-playstore'],))
                    ipa_build_process = Process(target=shell_exec, args=(base_command + ['-p', 'ios', '-R', settings['distribution_name'], '-I', ios_version, '-P', settings['pp_uuid'], '-O', dist_path, '-T', 'dist-adhoc'],))

                    apk_build_process.start()
                    ipa_build_process.start()

                    apk_build_process.join()
                    ipa_build_process.join()

                    # rename app files
                    dist_path += '/'
                    datecode_appname = project_name + '-' + str(get_datecode())
                    shell_exec(['mv', (dist_path + app_name_escaped_spaces + '.ipa'), (dist_path + datecode_appname + '.ipa')])
                    shell_exec(['mv', (dist_path + app_name_escaped_spaces + '.apk'), (dist_path + datecode_appname + '.apk')])

                print 'finished generating files for distribution'

            #shell_exec('osascript -e \'tell app "System Events" to display dialog "APK successfully installed to all connected devices."\'') # popup on complete
        else:
            notification = color('red', '\n --> input out of range please enter valid numbers only\n')

def mainCLI():
    ''' main cli interface function '''
    # global vars
    last_choice = ''
    script_path = '/'.join(sys.argv[0].split('/')[0:-1]) + '/'
    script_path = '' if (len(script_path) == 1) else script_path

    # get settings from settings file
    config_xml_path = script_path + 'timagic_settings.xml'

    for elem in settings:
        settings[elem] = get_from_xml(config_xml_path, elem)

    # UI variables
    notification = '\n'
    projects = get_project_names()

    # check if libimobiledevice is installed
    has_libimobiledevice = False
    try:
        subprocess.call('idevice_id', stdout=subprocess.PIPE)
        has_libimobiledevice = True
    except:
        print 'libimobiledevice is not installed...'

    # print the ui
    user_input = sys.argv[1]

    project_num = ''
    ios_version = ''
    newest_ios_version = settings['latest_ios_version']

    # print help
    if str(user_input) in ['-h', '--help', 'help']:
        print_cli_help(has_libimobiledevice)
        return

    # print overview
    if str(user_input) in ['-l', '--list', 'list']:
        print_available_projects(projects)
        return

    # clear project
    if str(user_input) in ['-c', '--clean', 'clean']:
        shell_exec('clear')
        return

    # print version and info
    if str(user_input) in ['-v', '--version', 'version']:
        print_version_and_info()
        return

    # parse arguments
    if len(sys.argv) > 2:
        # set project name
        project_name = sys.argv[1]
        input_params = sys.argv[2]
        if len(sys.argv) > 3:
            ios_version += sys.argv[3]
    else:
        print color('red', '\n --> malformed call (use "--help" flag to lookup usage)\n')

    # check if project's name is valid
    if not (project_name in projects):
        print color('red', '\n --> no project with that name (use "--list" flag to list all available)\n')
        return

    # clear shell output
    shell_exec('clear')

    # get build parameters
    project_name = project_name
    tiapp_xml_path = settings['titanium_workspace_path'] + project_name + '/tiapp.xml'
    sdk_version = get_from_xml(tiapp_xml_path, 'sdk-version')
    app_id = get_from_xml(tiapp_xml_path, 'id')
    app_version = get_from_xml(tiapp_xml_path, 'version')
    app_name = get_from_xml(tiapp_xml_path, 'name')
    app_name_escaped_spaces = app_name.replace(' ', '\ ')
    app_name_no_spaces = app_name.replace(' ', '');
    ios_version = ios_version or newest_ios_version # default to newest iOS-version
    app_path = settings['titanium_workspace_path'] + project_name

    # get lists of connected devices
    android_device_list = subprocess.check_output(settings['adb_path'] + ' devices | grep device', shell=True).replace('\tdevice','').split('\n')[1:-1]

    # libimobiledevice bug @todo
    if has_libimobiledevice:
        ios_device_list = []#subprocess.check_output('idevice_id -l', shell=True).split('\n')[0:-1] if has_libimobiledevice else []
    else:
        ios_device_list = []

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
                    build_command_apk = base_command + ['--platform', 'android', '-b']
                    build_processes['android'] = Process( target=shell_exec, args=(build_command_apk,) )

                if ios_connected:
                    # default build for ios devices
                    print 'building ad-hoc IPA'
                    build_command_ipa = base_command + ['--platform', 'ios', '-R', settings['distribution_name'], '-I', ios_version, '-P', settings['pp_uuid'], '-O', settings['ipa_output_path'], '-T', 'dist-adhoc']
                    build_processes['ios'] = Process( target=shell_exec, args=(build_command_ipa,) )

                # start parallel builds and wait for them to finish
                for platform in build_processes:
                    build_processes[platform].start()
                    build_processes[platform].join()


            # install to connected devices
            apk_path = ''
            android_kwargs = { 'app_id': app_id }
            if android_connected:
                # get app path
                if input_params == 'todevice':
                    apk_path = settings['apk_output_path'] + app_name_escaped_spaces + '.apk'
                else:
                    apk_path = app_path +'/build/android/bin/' + (app_name_no_spaces if float(sdk_version[0:3]) >= 3.2 else 'app') + '.apk'

            ipa_path = ''
            ios_kwargs = {}
            if ios_connected:
                # get app path
                ipa_path = settings['ipa_output_path'] + app_name_escaped_spaces + '.ipa'

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
        # build ad-hoc IPA for given iOS-version
        shell_exec(base_command + ['-p', 'ios', '-R', settings['distribution_name'], '-I', ios_version, '-P', settings['pp_uuid'], '-O', settings['ipa_output_path'], '-T', 'dist-adhoc'])

    elif input_params == 'ipad' or input_params == 'iphone':
        # Install to and launch given iOS-Simulator
        shell_exec(base_command + ['-p', 'ios', '-I', ios_version, '-Y', input_params, '-S', ios_version, '-T', 'simulator'])

    elif input_params == 'apk':
        # build Play-Store APK
        password_flag = ('--store-password' if float(sdk_version[0:3]) >= 3.2 else '--password')
        shell_exec(base_command + ['-p', 'android', '-K', settings['keystore_path'], '-L', settings['keystore_alias'], password_flag, settings['keystore_pw'], '-O', settings['apk_output_path'], '-T', 'dist-playstore'])

    elif (input_params in ['dist', 'distbuild']) and qrcode_available:
        # generate distribution files
        print 'generating files for distribution'
        dist_path = distribute(project_name, app_id, app_version, app_name)

        if input_params == 'distbuild':
            # build ipa and apk
            password_flag = ('--store-password' if float(sdk_version[0:3]) >= 3.2 else '--password')
            apk_build_process = Process(target=shell_exec, args=(base_command + ['-p', 'android', '-K', settings['keystore_path'], '-L', settings['keystore_alias'], password_flag, settings['keystore_pw'], '-O', dist_path, '-T', 'dist-playstore'],))
            ipa_build_process = Process(target=shell_exec, args=(base_command + ['-p', 'ios', '-R', settings['distribution_name'], '-I', ios_version, '-P', settings['pp_uuid'], '-O', dist_path, '-T', 'dist-adhoc'],))

            apk_build_process.start()
            ipa_build_process.start()

            apk_build_process.join()
            ipa_build_process.join()

            # rename app files
            dist_path += '/'
            datecode_appname = project_name + '-' + str(get_datecode())
            shell_exec(['mv', (dist_path + app_name_escaped_spaces + '.ipa'), (dist_path + datecode_appname + '.ipa')])
            shell_exec(['mv', (dist_path + app_name_escaped_spaces + '.apk'), (dist_path + datecode_appname + '.apk')])

        print 'finished generating files for distribution'

if __name__ == '__main__':
    # launch CLI or UI version depending on given arguments
    if len(sys.argv) > 1:
        mainCLI()
    else:
        main()