# -*- mode: python -*-
a = Analysis(['timagic.py'],
			 pathex=['/Users/hendrik_elsner/Documents/magic'],
			 hiddenimports=[],
			 hookspath=None,
			 runtime_hooks=None)

# Add additional resources like the ones below
a.datas += [('timagic_settings.xml', 'timagic_settings.xml', 'DATA')]

pyz = PYZ(a.pure)
exe = EXE(pyz,
		  a.scripts,
		  exclude_binaries=True,
		  name='timagic',
		  debug=False,
		  strip=None,
		  upx=True,
		  console=False )
coll = COLLECT(exe,
			   a.binaries,
			   a.zipfiles,
			   a.datas,
			   strip=None,
			   upx=True,
			   name='timagic')
app = BUNDLE(coll,
			 name='timagic.app',
			 icon=None)
