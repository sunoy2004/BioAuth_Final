# BioAuth Mobile - React Native Implementation

A React Native mobile application for multi-modal biometric authentication using Bluetooth Low Energy (BLE) and Supabase backend.

## Overview

This mobile application is a port of the web-based biometric authentication system to React Native, enabling deployment on iOS and Android devices. It maintains the same core functionality while adapting to native mobile APIs.

## Features

- **Multi-Modal Biometric Authentication**: Face, voice, and gesture recognition
- **Native BLE Integration**: Uses `react-native-ble-plx` for Bluetooth communication
- **Supabase Backend**: Cloud storage for biometric data and authentication logs
- **Native Permissions**: Proper handling of BLE, Camera, and Microphone permissions
- **Cross-Platform**: Works on both iOS and Android

## Technology Stack

- **Framework**: React Native with Expo
- **BLE Library**: react-native-ble-plx
- **Permissions**: react-native-permissions
- **Backend**: Supabase (@supabase/supabase-js)
- **UI**: React Native Components

## Prerequisites

Before running the application, ensure you have the following installed:

1. Node.js (version 16.x or higher)
2. npm (usually comes with Node.js)
3. Expo CLI (installed globally)

## Installation

1. Clone or download the project
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

Before running the application, you need to configure the Supabase credentials in `App.js`:

```javascript
const SUPABASE_URL = 'https://[YOUR_PROJECT_ID].supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiI...[YOUR_LONG_KEY]...';
```

Replace these placeholders with your actual Supabase project credentials.

## Running the Application

To start the development server:

```bash
npm start
```

Then follow the instructions to run on:
- iOS: Press `i`
- Android: Press `a`
- Web: Press `w`

## Native Permissions

### Android

The application requires the following permissions in `app.json`:

- `android.permission.BLUETOOTH_SCAN`
- `android.permission.BLUETOOTH_CONNECT`
- `android.permission.ACCESS_FINE_LOCATION`
- `android.permission.CAMERA`
- `android.permission.RECORD_AUDIO`

### iOS

The application requires the following usage descriptions in `app.json`:

- `NSBluetoothAlwaysUsageDescription`
- `NSCameraUsageDescription`
- `NSMicrophoneUsageDescription`

## Architecture

The application follows a modular architecture:

1. **BLE Management**: Uses `react-native-ble-plx` for all Bluetooth operations
2. **Supabase Integration**: Handles data storage and retrieval
3. **Permission Handling**: Manages all required native permissions
4. **UI Components**: Modern, responsive interface using React Native components

## Key Components

### App.js
Main application component that handles:
- BLE connection management
- Supabase client initialization
- User enrollment and authentication
- Permission requests
- UI rendering

### BLE Operations
- Device scanning and connection
- Service and characteristic discovery
- Data transmission with chunking and framing

### Data Management
- User enrollment with biometric data storage
- User authentication against stored data
- Activity logging

## Development Notes

1. The application uses Base64 encoding for BLE data transmission as required by `react-native-ble-plx`
2. Chunking and framing protocols are maintained from the original implementation
3. All native permissions are properly configured in `app.json`
4. The UI is designed to be mobile-friendly and responsive

## Troubleshooting

### BLE Connection Issues
- Ensure Bluetooth is enabled on your device
- Make sure the Arduino device is advertising
- Check that all required permissions are granted

### Supabase Connection Issues
- Verify your Supabase URL and API key
- Ensure your database tables are properly configured
- Check network connectivity

## Future Enhancements

1. Implement actual biometric data capture (camera, microphone)
2. Add more sophisticated error handling
3. Implement offline capabilities
4. Add more detailed logging and analytics
5. Improve UI/UX with more advanced components