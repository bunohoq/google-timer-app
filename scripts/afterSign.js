const { execSync } = require('child_process');
const path = require('path');

// electron-builder는 Developer ID 인증서가 없으면 서명을 건너뛰는데,
// 서명이 전혀 없는 arm64 앱은 다운로드 후 macOS에서 "손상됨"으로 잘못 표시된다.
// 인증서가 없을 때는 최소한 임시(ad-hoc) 서명이라도 넣어준다.
module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  if (process.env.CSC_LINK || process.env.CSC_NAME) return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  execSync(`xattr -cr "${appPath}"`);
  execSync(`codesign --force --deep --sign - "${appPath}"`);
};
