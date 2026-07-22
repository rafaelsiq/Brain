# Place your upload keystore here for release AAB builds.
# Generate with:
# keytool -genkey -v -keystore brain-release.keystore -alias brain -keyalg RSA -keysize 2048 -validity 10000
#
# Then create android/key.properties (do not commit):
# storePassword=...
# keyPassword=...
# keyAlias=brain
# storeFile=../brain-release.keystore
