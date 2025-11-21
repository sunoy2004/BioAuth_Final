# Multi-Modal Biometric Authentication System

A complete end-to-end biometric authentication system with React frontend, Arduino Nano 33 BLE peripheral, and Supabase backend integration.

## Project Overview

This project implements a secure multi-modal biometric authentication system that combines facial recognition, voice authentication, and gesture recognition. The system uses Web Bluetooth API to communicate with an Arduino Nano 33 BLE device and stores biometric data in a Supabase database.

## Key Features

- **Multi-Modal Biometric Authentication**: Face, voice, and gesture recognition
- **BLE Integration**: Communicates with Arduino Nano 33 BLE via Web Bluetooth API
- **Cloud Storage**: Securely stores biometric data in Supabase
- **Persistent Connection**: Maintains BLE connection until explicitly disconnected
- **Authentication Logging**: Tracks all authentication attempts with IP addresses
- **Responsive UI**: Modern React interface with Tailwind CSS styling

## Technology Stack

- **Frontend**: React with TypeScript, Vite, Tailwind CSS, shadcn-ui
- **Bluetooth**: Web Bluetooth API for Arduino communication
- **Backend**: Supabase for data storage and authentication
- **Hardware**: Arduino Nano 33 BLE for biometric data processing
- **Database**: Supabase PostgreSQL with two tables:
  - `enrollments`: Stores user biometric data
  - `authentication_logs`: Tracks authentication attempts

## System Architecture

### Components

1. **React Web Application**
   - User interface for enrollment and authentication
   - Biometric data capture (face, voice, gesture)
   - BLE device connection and communication
   - Supabase integration for data storage

2. **Arduino Nano 33 BLE**
   - Receives biometric data from the web app
   - Processes authentication requests
   - Communicates via BLE GATT characteristics

3. **Supabase Backend**
   - `enrollments` table: Stores user biometric data with IP tracking
   - `authentication_logs` table: Records all authentication attempts

### BLE Communication Protocol

- **Service UUID**: `00001101-0000-1000-8000-00805f9b34fb`
- **Characteristics**:
  - Command (`00001102-0000-1000-8000-00805f9b34fb`): Send commands to Arduino
  - Result (`00001103-0000-1000-8000-00805f9b34fb`): Receive responses from Arduino

## Getting Started

### Prerequisites

- Node.js & npm installed
- Arduino Nano 33 BLE board
- Web browser that supports Web Bluetooth (Chrome, Edge, Opera)
- Supabase account with configured database

### Installation

```sh
# Clone the repository
git clone https://github.com/sunoy2004/BioAuth_Final.git

# Navigate to the project directory
cd BioAuth_Final

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Supabase Database Setup

Create the required tables in your Supabase database:

```sql
-- Create enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT UNIQUE NOT NULL,
  face_vector TEXT,
  voice_vector TEXT,
  gesture_vector TEXT,
  client_ip TEXT,
  command TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create authentication_logs table
CREATE TABLE IF NOT EXISTS authentication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  client_ip TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_name ON authentication_logs(user_name);
CREATE INDEX IF NOT EXISTS idx_auth_logs_success ON authentication_logs(success);
CREATE INDEX IF NOT EXISTS idx_auth_logs_timestamp ON authentication_logs(timestamp);
```

### Arduino Setup

1. Open the Arduino IDE
2. Install the ArduinoBLE library
3. Upload the provided sketch to your Arduino Nano 33 BLE
4. Ensure the Arduino is powered and advertising

## Usage

1. Start the development server: `npm run dev`
2. Open the application in a Web Bluetooth supported browser
3. Connect to your Arduino Nano 33 BLE device
4. Choose between enrollment and authentication modes
5. Capture biometric data (face, voice, gesture)
6. Submit data for processing

## Project Structure

```
src/
├── components/
│   ├── biometric/       # Biometric capture components
│   ├── bluetooth/       # BLE connection component
│   └── ui/              # UI components
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions
├── pages/               # Page components
└── types/               # TypeScript type definitions
```

## Security Features

- **Data Encryption**: Biometric data stored as Base64 encoded strings
- **IP Tracking**: All operations logged with client IP addresses
- **Authentication Logging**: Complete audit trail of authentication attempts
- **Secure Communication**: HTTPS communication with Supabase
- **BLE Security**: Platform-level encryption for Bluetooth communication

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- React and Vite communities
- Supabase for backend services
- Arduino for BLE hardware platform