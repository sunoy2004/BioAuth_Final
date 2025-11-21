import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { PERMISSIONS, request, check, RESULTS } from 'react-native-permissions';
import { Base64 } from 'react-native-base64';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration - to be replaced by user
const SUPABASE_URL = 'https://[YOUR_PROJECT_ID].supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiI...[YOUR_LONG_KEY]...';

// BLE Service and Characteristic UUIDs
const BIOMETRIC_SERVICE_UUID = '00001101-0000-1000-8000-00805f9b34fb';
const COMMAND_CHAR_UUID = '00001102-0000-1000-8000-00805f9b34fb';
const RESULT_CHAR_UUID = '00001103-0000-1000-8000-00805f9b34fb';

// Framing protocol constants
const START_BYTE = 0xAA;
const END_BYTE = 0xBB;

const App = () => {
  const [manager, setManager] = useState(null);
  const [device, setDevice] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userName, setUserName] = useState('');
  const [supabase, setSupabase] = useState(null);
  const [log, setLog] = useState([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Initialize BLE manager
  useEffect(() => {
    const bleManager = new BleManager();
    setManager(bleManager);

    // Cleanup on unmount
    return () => {
      if (device) {
        device.cancelConnection();
      }
    };
  }, []);

  // Initialize Supabase client
  useEffect(() => {
    const initSupabase = async () => {
      try {
        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
        setSupabase(client);
      } catch (error) {
        addToLog(`Failed to initialize Supabase client: ${error.message}`);
      }
    };

    initSupabase();
  }, []);

  const addToLog = (message) => {
    setLog(prevLog => [...prevLog, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Request required permissions
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      // Request Android permissions
      const bluetoothScan = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        {
          title: 'Bluetooth Scan Permission',
          message: 'This app needs Bluetooth scan permission to discover devices',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      const bluetoothConnect = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        {
          title: 'Bluetooth Connect Permission',
          message: 'This app needs Bluetooth connect permission to communicate with devices',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      const camera = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'This app needs camera permission to capture biometric data',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      const microphone = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'This app needs microphone permission to capture voice biometric data',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      
      return (
        bluetoothScan === PermissionsAndroid.RESULTS.GRANTED &&
        bluetoothConnect === PermissionsAndroid.RESULTS.GRANTED &&
        camera === PermissionsAndroid.RESULTS.GRANTED &&
        microphone === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      // Request iOS permissions
      const bluetoothResult = await request(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL);
      const cameraResult = await request(PERMISSIONS.IOS.CAMERA);
      const microphoneResult = await request(PERMISSIONS.IOS.MICROPHONE);
      
      return (
        bluetoothResult === RESULTS.GRANTED &&
        cameraResult === RESULTS.GRANTED &&
        microphoneResult === RESULTS.GRANTED
      );
    }
  };

  // Scan and connect to BLE device
  const connectToBLEDevice = async () => {
    try {
      // Check permissions first
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        Alert.alert('Permissions Required', 'Please grant all required permissions to use this app.');
        return;
      }

      addToLog('Starting BLE device scan...');
      
      // Check if BLE is available
      const state = await manager.state();
      if (state !== 'PoweredOn') {
        Alert.alert('BLE Not Available', 'Please enable Bluetooth on your device.');
        return;
      }

      // Start scanning for devices
      manager.startDeviceScan(null, null, (error, scannedDevice) => {
        if (error) {
          addToLog(`Scan error: ${error.message}`);
          return;
        }

        // Look for our specific device
        if (scannedDevice.name === 'BiometricAuthDevice') {
          manager.stopDeviceScan();
          addToLog(`Found device: ${scannedDevice.name}`);
          
          // Connect to the device
          manager.connectToDevice(scannedDevice.id)
            .then(device => {
              addToLog('Connected to device');
              setDevice(device);
              setIsConnected(true);
              
              // Discover services and characteristics
              return device.discoverAllServicesAndCharacteristics();
            })
            .then(device => {
              addToLog('Services and characteristics discovered');
              Alert.alert('Success', 'Connected to BiometricAuthDevice');
            })
            .catch(error => {
              addToLog(`Connection error: ${error.message}`);
              Alert.alert('Connection Error', error.message);
            });
        }
      });

      // Stop scanning after 10 seconds
      setTimeout(() => {
        manager.stopDeviceScan();
        if (!isConnected) {
          addToLog('Device scan timeout');
        }
      }, 10000);
    } catch (error) {
      addToLog(`Connection failed: ${error.message}`);
      Alert.alert('Connection Failed', error.message);
    }
  };

  // Disconnect from BLE device
  const disconnectFromBLEDevice = async () => {
    if (device) {
      try {
        await device.cancelConnection();
        setDevice(null);
        setIsConnected(false);
        addToLog('Disconnected from device');
      } catch (error) {
        addToLog(`Disconnection error: ${error.message}`);
      }
    }
  };

  // Convert Uint8Array to Base64 string
  const arrayToBase64 = (array) => {
    return Base64.btoa(String.fromCharCode.apply(null, array));
  };

  // Send chunked data via BLE
  const sendChunkedData = async (data, commandType) => {
    if (!device) {
      throw new Error('No device connected');
    }

    try {
      // Convert string data to Uint8Array
      const encoder = new TextEncoder();
      const dataArray = encoder.encode(data);
      
      // Calculate number of chunks
      const CHUNK_SIZE = 18; // 20 bytes minus 2 framing bytes
      const numChunks = Math.ceil(dataArray.length / CHUNK_SIZE);
      
      // Send start frame
      const startFrame = new Uint8Array([START_BYTE, commandType, numChunks]);
      await device.writeCharacteristicWithoutResponseForService(
        BIOMETRIC_SERVICE_UUID,
        COMMAND_CHAR_UUID,
        arrayToBase64(startFrame)
      );
      
      // Send data chunks
      for (let i = 0; i < numChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, dataArray.length);
        const chunk = dataArray.slice(start, end);
        
        // Create frame with chunk data
        const frame = new Uint8Array(chunk.length + 2);
        frame[0] = START_BYTE;
        frame[frame.length - 1] = END_BYTE;
        frame.set(chunk, 1);
        
        // Send chunk
        await device.writeCharacteristicWithoutResponseForService(
          BIOMETRIC_SERVICE_UUID,
          COMMAND_CHAR_UUID,
          arrayToBase64(frame)
        );
      }
      
      // Send end frame
      const endFrame = new Uint8Array([END_BYTE, 0, 0]);
      await device.writeCharacteristicWithoutResponseForService(
        BIOMETRIC_SERVICE_UUID,
        COMMAND_CHAR_UUID,
        arrayToBase64(endFrame)
      );
    } catch (error) {
      throw new Error(`Failed to send data: ${error.message}`);
    }
  };

  // Enroll user biometric data
  const enrollUser = async () => {
    if (!userName.trim()) {
      Alert.alert('Validation Error', 'Please enter a username');
      return;
    }

    if (!device) {
      Alert.alert('Connection Error', 'Please connect to a device first');
      return;
    }

    if (!supabase) {
      Alert.alert('Configuration Error', 'Supabase client not initialized');
      return;
    }

    setIsEnrolling(true);
    addToLog(`Starting enrollment for user: ${userName}`);

    try {
      // Simulate biometric data collection (in a real app, this would involve actual camera/microphone)
      const faceData = `face_data_${Date.now()}`;
      const voiceData = `voice_data_${Date.now()}`;
      const gestureData = `gesture_data_${Date.now()}`;

      // Send enrollment command via BLE
      await sendChunkedData(userName, 0x01); // 0x01 = enroll command
      
      // In a real implementation, we would collect actual biometric data here
      // For now, we'll simulate the process
      
      // Store in Supabase
      const { data, error } = await supabase
        .from('enrollments')
        .insert([
          {
            user_name: userName,
            face_data: faceData,
            voice_data: voiceData,
            gesture_data: gestureData,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      addToLog(`User ${userName} enrolled successfully`);
      Alert.alert('Success', `User ${userName} enrolled successfully`);
    } catch (error) {
      addToLog(`Enrollment failed: ${error.message}`);
      Alert.alert('Enrollment Failed', error.message);
    } finally {
      setIsEnrolling(false);
    }
  };

  // Authenticate user
  const authenticateUser = async () => {
    if (!userName.trim()) {
      Alert.alert('Validation Error', 'Please enter a username');
      return;
    }

    if (!device) {
      Alert.alert('Connection Error', 'Please connect to a device first');
      return;
    }

    if (!supabase) {
      Alert.alert('Configuration Error', 'Supabase client not initialized');
      return;
    }

    setIsAuthenticating(true);
    addToLog(`Starting authentication for user: ${userName}`);

    try {
      // Send authentication command via BLE
      await sendChunkedData(userName, 0x02); // 0x02 = authenticate command
      
      // In a real implementation, we would collect actual biometric data here
      // For now, we'll simulate the process
      
      // Check if user exists in Supabase
      const { data, error } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_name', userName)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
        throw new Error(`Database error: ${error.message}`);
      }

      if (data) {
        addToLog(`User ${userName} authenticated successfully`);
        Alert.alert('Success', `User ${userName} authenticated successfully`);
      } else {
        addToLog(`Authentication failed: User ${userName} not found`);
        Alert.alert('Authentication Failed', `User ${userName} not found`);
      }
    } catch (error) {
      addToLog(`Authentication failed: ${error.message}`);
      Alert.alert('Authentication Failed', error.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>BioAuth Mobile</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <TouchableOpacity
          style={[styles.button, isConnected ? styles.disconnectButton : styles.connectButton]}
          onPress={isConnected ? disconnectFromBLEDevice : connectToBLEDevice}
        >
          <Text style={styles.buttonText}>
            {isConnected ? 'Disconnect BLE' : 'Connect BLE'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.status}>
          Status: {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Management</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter username"
          value={userName}
          onChangeText={setUserName}
        />
        
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.enrollButton]}
            onPress={enrollUser}
            disabled={!isConnected || isEnrolling || isAuthenticating}
          >
            <Text style={styles.buttonText}>
              {isEnrolling ? 'Enrolling...' : 'Enroll User'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.authButton]}
            onPress={authenticateUser}
            disabled={!isConnected || isEnrolling || isAuthenticating}
          >
            <Text style={styles.buttonText}>
              {isAuthenticating ? 'Authenticating...' : 'Authenticate User'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Log</Text>
        {log.map((entry, index) => (
          <Text key={index} style={styles.logEntry}>{entry}</Text>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 5,
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  disconnectButton: {
    backgroundColor: '#f44336',
  },
  enrollButton: {
    backgroundColor: '#2196F3',
    flex: 1,
    marginRight: 5,
  },
  authButton: {
    backgroundColor: '#FF9800',
    flex: 1,
    marginLeft: 5,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  status: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logEntry: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
    padding: 5,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
});

export default App;