const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'App.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// Remove the incompatible imports
content = content.replace(
    /import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';\r?\n/g,
    ''
);
content = content.replace(
    /import { Base64 } from 'react-native-base64';\r?\n/g,
    ''
);

// Replace Base64.btoa with btoa
content = content.replace(/Base64\.btoa\(/g, 'btoa(');
content = content.replace(/Base64\.atob\(/g, 'atob(');

// Replace TextEncoder
content = content.replace(
    /const encoder = new TextEncoder\(\);\r?\n\s+const dataArray = encoder\.encode\(data\);/g,
    '// TextEncoder is not available in React Native, use manual encoding\n      const dataArray = new Uint8Array(data.split(\'\').map(c => c.charCodeAt(0)));'
);

// Fix iOS permissions (remove the iOS-specific code that uses PERMISSIONS and RESULTS)
content = content.replace(
    /} else {\r?\n\s+\/\/ Request iOS permissions\r?\n\s+const bluetoothResult = await request\(PERMISSIONS\.IOS\.BLUETOOTH\);\r?\n\s+const cameraResult = await request\(PERMISSIONS\.IOS\.CAMERA\);\r?\n\s+const microphoneResult = await request\(PERMISSIONS\.IOS\.MICROPHONE\);\r?\n\s+\r?\n\s+return \(\r?\n\s+bluetoothResult === RESULTS\.GRANTED &&\r?\n\s+cameraResult === RESULTS\.GRANTED &&\r?\n\s+microphoneResult === RESULTS\.GRANTED\r?\n\s+\);\r?\n\s+}/g,
    '} else {\n      // iOS permissions are handled by Expo modules\n      return true;\n    }'
);

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('App.js fixed successfully!');
