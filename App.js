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
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

// Supabase configuration - to be replaced by user
const SUPABASE_URL = 'https://ozsghnwhrmiznnbrkour.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96c2dobndocm1pem5uYnJrb3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjA0MDMsImV4cCI6MjA3OTEzNjQwM30.RA8zMhBzRz0YE7mSnwd15z1zeyMTI-tvcZlWcGTpNfU';

// BLE Service and Characteristic UUIDs
// Using the correct 128-bit format for Arduino Nano 33 BLE
const BIOMETRIC_SERVICE_UUID = '00001101-0000-1000-8000-00805f9b34fb';
const FACE_DATA_CHAR_UUID = '00001102-0000-1000-8000-00805f9b34fb';
const VOICE_DATA_CHAR_UUID = '00001103-0000-1000-8000-00805f9b34fb';
const GESTURE_DATA_CHAR_UUID = '00001104-0000-1000-8000-00805f9b34fb';
const TRIGGER_CHAR_UUID = '00001105-0000-1000-8000-00805f9b34fb';
const AUTH_RESULT_CHAR_UUID = '00001106-0000-1000-8000-00805f9b34fb';

// Framing protocol constants
const START_BYTE = 0xAA;
const END_BYTE = 0xBB;
const CMD_ENROLL = 0x01;
const CMD_AUTHENTICATE = 0x02;

const App = () => {
  const [manager, setManager] = useState(null);
  const [device, setDevice] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userName, setUserName] = useState('');
  const [supabase, setSupabase] = useState(null);
  const [log, setLog] = useState([]);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [monitorSubscription, setMonitorSubscription] = useState(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [hasAudioPermission, setHasAudioPermission] = useState(null);
  const [recording, setRecording] = useState(null);

  // Initialize BLE manager
  useEffect(() => {
    const bleManager = new BleManager();
    setManager(bleManager);

    // Cleanup on unmount
    return () => {
      if (device) {
        device.cancelConnection();
      }
      // Remove monitoring subscription
      if (monitorSubscription) {
        monitorSubscription.remove();
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
      const bluetoothResult = await request(PERMISSIONS.IOS.BLUETOOTH);
      const cameraResult = await request(PERMISSIONS.IOS.CAMERA);
      const microphoneResult = await request(PERMISSIONS.IOS.MICROPHONE);
      
      return (
        bluetoothResult === RESULTS.GRANTED &&
        cameraResult === RESULTS.GRANTED &&
        microphoneResult === RESULTS.GRANTED
      );
    }
  };
  
  // Request camera and audio permissions
  const requestCameraAndAudioPermissions = async () => {
    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
    const { status: audioStatus } = await Audio.requestPermissionsAsync();
    
    setHasCameraPermission(cameraStatus === 'granted');
    setHasAudioPermission(audioStatus === 'granted');
    
    return cameraStatus === 'granted' && audioStatus === 'granted';
  };
  
  // Initialize camera and audio permissions
  useEffect(() => {
    requestCameraAndAudioPermissions();
  }, []);

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

      // Start scanning for devices with our service
      manager.startDeviceScan([BIOMETRIC_SERVICE_UUID], null, (error, scannedDevice) => {
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
              // Check if the device has our service
              return device.services();
            })
            .then(services => {
              const service = services.find(s => s.uuid === BIOMETRIC_SERVICE_UUID);
              if (service) {
                addToLog('Services and characteristics discovered');
                
                // Monitor notifications from the device
                const subscription = device.monitorCharacteristicForService(
                  BIOMETRIC_SERVICE_UUID,
                  AUTH_RESULT_CHAR_UUID,
                  (error, characteristic) => {
                    if (error) {
                      addToLog(`Notification error: ${error.message}`);
                      return;
                    }
                    
                    // Decode the received data
                    const data = Base64.atob(characteristic.value);
                    const byteArray = new Uint8Array(data.split('').map(c => c.charCodeAt(0)));
                    
                    // Process the notification
                    if (byteArray[0] === START_BYTE && byteArray[byteArray.length - 1] === END_BYTE) {
                      const resultCode = byteArray[1];
                      const resultMessage = resultCode === 0x01 ? 'Enrollment Successful' : 
                                          resultCode === 0x02 ? 'Authentication Successful' : 
                                          resultCode === 0xF1 ? 'Enrollment Failed' : 
                                          resultCode === 0xF2 ? 'Authentication Failed' : 'Unknown Result';
                      
                      addToLog(`Device Result: ${resultMessage}`);
                      Alert.alert('Device Result', resultMessage);
                    }
                  }
                );
                
                setMonitorSubscription(subscription);
                addToLog('Started monitoring device notifications');
                
                Alert.alert('Success', 'Connected to BiometricAuthDevice');
              } else {
                throw new Error('Required service not found on device');
              }
            })
            .catch(error => {
              addToLog(`Connection error: ${error.message}`);
              Alert.alert('Connection Error', error.message);
              // Reset connection state
              setDevice(null);
              setIsConnected(false);
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
        // Remove monitoring subscription
        if (monitorSubscription) {
          monitorSubscription.remove();
          setMonitorSubscription(null);
        }
        
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
  
  // Capture face biometric data
  const captureFaceData = async () => {
    if (!hasCameraPermission) {
      throw new Error('Camera permission not granted');
    }
    
    // In a real implementation, this would capture an image and process it
    // For demonstration, we'll return simulated data
    return `face_vector_${Date.now()}`;
  };
  
  // Capture voice biometric data
  const captureVoiceData = async () => {
    if (!hasAudioPermission) {
      throw new Error('Microphone permission not granted');
    }
    
    // In a real implementation, this would record and process audio
    // For demonstration, we'll return simulated data
    return `voice_vector_${Date.now()}`;
  };
  
  // Capture gesture biometric data
  const captureGestureData = async () => {
    // In a real implementation, this would capture gesture data from sensors
    // For demonstration, we'll return simulated data
    return `gesture_vector_${Date.now()}`;
  };

  // Send chunked data via BLE
  const sendChunkedData = async (data, commandType, characteristicUUID) => {
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
        characteristicUUID,
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
          characteristicUUID,
          arrayToBase64(frame)
        );
      }
      
      // Send end frame
      const endFrame = new Uint8Array([END_BYTE, 0, 0]);
      await device.writeCharacteristicWithoutResponseForService(
        BIOMETRIC_SERVICE_UUID,
        characteristicUUID,
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
      // Collect actual biometric data
      const faceData = await captureFaceData();
      const voiceData = await captureVoiceData();
      const gestureData = await captureGestureData();
      
      // Send face data
      await sendChunkedData(faceData, 0x01, FACE_DATA_CHAR_UUID);
      
      // Send voice data
      await sendChunkedData(voiceData, 0x01, VOICE_DATA_CHAR_UUID);
      
      // Send gesture data
      await sendChunkedData(gestureData, 0x01, GESTURE_DATA_CHAR_UUID);
      
      // Trigger enrollment
      const triggerFrame = new Uint8Array([START_BYTE, CMD_ENROLL, 0x00, END_BYTE]);
      await device.writeCharacteristicWithoutResponseForService(
        BIOMETRIC_SERVICE_UUID,
        TRIGGER_CHAR_UUID,
        arrayToBase64(triggerFrame)
      );
      
      // Store in Supabase
      const { data, error } = await supabase
        .from('enrollments')
        .insert([
          {
            user_name: userName,
            face_vector: faceData,
            voice_vector: voiceData,
            gesture_vector: gestureData
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
      // Collect actual biometric data
      const faceData = await captureFaceData();
      const voiceData = await captureVoiceData();
      const gestureData = await captureGestureData();
      
      // Send face data
      await sendChunkedData(faceData, 0x02, FACE_DATA_CHAR_UUID);
      
      // Send voice data
      await sendChunkedData(voiceData, 0x02, VOICE_DATA_CHAR_UUID);
      
      // Send gesture data
      await sendChunkedData(gestureData, 0x02, GESTURE_DATA_CHAR_UUID);
      
      // Trigger authentication
      const triggerFrame = new Uint8Array([START_BYTE, CMD_AUTHENTICATE, 0x00, END_BYTE]);
      await device.writeCharacteristicWithoutResponseForService(
        BIOMETRIC_SERVICE_UUID,
        TRIGGER_CHAR_UUID,
        arrayToBase64(triggerFrame)
      );
      
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