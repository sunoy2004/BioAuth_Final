# BioAuth Mobile - React Native Deployment Guide

This guide provides instructions for deploying the BioAuth Mobile application, a multi-modal biometric authentication system built with React Native and Expo.

## Architecture Overview

The application has been converted from a React/Web Bluetooth app to a React Native mobile app with the following key changes:

### Component Comparison

| Component | Web App (Original) | Mobile App (Required) |
|-----------|-------------------|----------------------|
| Platform | React / Web | React Native |
| BLE API | navigator.bluetooth | react-native-ble-plx |
| Supabase Init | Global CDN Script | import { createClient } from '@supabase/supabase-js' |
| Permissions | Browser Prompts | Native OS Manifest/Info.plist entries |

## Native Permission Configuration

### Android Permissions
The following permissions are configured in `app.json`:
- `android.permission.BLUETOOTH_SCAN` (Required for Android 12+)
- `android.permission.BLUETOOTH_CONNECT` (Required for Android 12+)
- `android.permission.ACCESS_FINE_LOCATION` (Required for BLE scanning on older Android)
- `android.permission.CAMERA`
- `android.permission.RECORD_AUDIO`

### iOS Permissions
The following permissions are configured in `app.json`:
- `NSBluetoothAlwaysUsageDescription`: "Required to connect to the Arduino Biometric Device."
- `NSCameraUsageDescription`: "Required to acquire Face Biometric Data."
- `NSMicrophoneUsageDescription`: "Required to acquire Voice Biometric Data."

## Dependencies

The application uses the following key dependencies:
- `react-native-ble-plx` for Bluetooth Low Energy communication
- `@supabase/supabase-js` for database operations
- `expo-camera` for face biometric capture
- `expo-av` for voice biometric capture
- `react-native-permissions` for runtime permission handling

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Supabase**:
   Update the following constants in `App.js` with your Supabase project credentials:
   ```javascript
   const SUPABASE_URL = 'https://[YOUR_PROJECT_ID].supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiI...[YOUR_LONG_KEY]...';
   ```

3. **Start the Development Server**:
   ```bash
   npx expo start
   ```

4. **Build for Deployment**:
   For Android:
   ```bash
   eas build -p android
   ```
   
   For iOS:
   ```bash
   eas build -p ios
   ```

## BLE Implementation Details

The application uses `react-native-ble-plx` for BLE communication with the following key features:

1. **Service and Characteristics**:
   - Service UUID: `00001101-0000-1000-8000-00805f9b34fb`
   - Face Data Characteristic: `00001102-0000-1000-8000-00805f9b34fb`
   - Voice Data Characteristic: `00001103-0000-1000-8000-00805f9b34fb`
   - Gesture Data Characteristic: `00001104-0000-1000-8000-00805f9b34fb`
   - Trigger Characteristic: `00001105-0000-1000-8000-00805f9b34fb`
   - Auth Result Notification: `00001106-0000-1000-8000-00805f9b34fb`

2. **Framing Protocol**:
   - START_BYTE: 0xAA
   - END_BYTE: 0xBB
   - Commands: 0x01 (Enroll), 0x02 (Authenticate)

3. **Data Transfer**:
   - Chunked data transmission with Base64 encoding
   - Automatic reconnection handling
   - Notification monitoring for device responses

## Biometric Data Collection

The application implements stubs for collecting biometric data:
- Face data collection using `expo-camera`
- Voice data collection using `expo-av`
- Gesture data collection (simulated)

In a production environment, these stubs would be replaced with actual biometric capture and processing logic.

## Supabase Database Schema

The application expects a Supabase table named `enrollments` with the following columns:
- `id` (UUID)
- `user_name` (TEXT)
- `face_vector` (TEXT)
- `voice_vector` (TEXT)
- `gesture_vector` (TEXT)

## Testing

To test the application:

1. Ensure your Arduino Nano 33 BLE is running and advertising as "BiometricAuthDevice"
2. Start the Expo development server
3. Connect to the device using the "Connect BLE" button
4. Enroll a user by entering a username and clicking "Enroll User"
5. Authenticate the user by entering the same username and clicking "Authenticate User"

## Deployment

For production deployment:

1. Update Supabase credentials in App.js
2. Build the application using EAS Build
3. Submit to app stores following their respective guidelines

## Troubleshooting

Common issues and solutions:

1. **BLE Connection Failures**:
   - Ensure Bluetooth is enabled on the device
   - Check that the Arduino device is advertising correctly
   - Verify that all required permissions are granted

2. **Permission Issues**:
   - On Android, ensure all permissions in app.json are granted at runtime
   - On iOS, check that Info.plist contains all required usage descriptions

3. **Supabase Connection Errors**:
   - Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
   - Check network connectivity
   - Ensure the Supabase table schema matches the expected structure