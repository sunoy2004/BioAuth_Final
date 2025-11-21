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
import { createClient } from '@supabase/supabase-js';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

// Supabase configuration - replace with your own values
const SUPABASE_URL = 'https://ozsghnwhrmiznnbrkour.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96c2dobndocm1pem5uYnJrb3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjA0MDMsImV4cCI6MjA3OTEzNjQwM30.RA8zMhBzRz0YE7mSnwd15z1zeyMTI-tvcZlWcGTpNfU';

// BLE Service and Characteristic UUIDs (Arduino Nano 33 BLE Sense Rev2)
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

  // Initialize BLE manager
  useEffect(() => {
    const bleManager = new BleManager();
    setManager(bleManager);
    return () => {
      if (device) device.cancelConnection();
      if (monitorSubscription) monitorSubscription.remove();
    };
  }, []);

  // Initialize Supabase client
  useEffect(() => {
    const initSupabase = async () => {
      try {
        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        setSupabase(client);
      } catch (error) {
        addToLog(`Failed to initialize Supabase client: ${error.message}`);
      }
    };
    initSupabase();
  }, []);

  const addToLog = (message) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Request permissions (Android BLE + location, iOS handled by Expo)
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ];
      const results = await PermissionsAndroid.requestMultiple(permissions);
      const allGranted = permissions.every(p => results[p] === PermissionsAndroid.RESULTS.GRANTED);
      if (!allGranted) Alert.alert('Permissions Required', 'Bluetooth and location permissions are needed.');
      return allGranted;
    }
    return true;
  };

  const requestCameraAndAudioPermissions = async () => {
    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
    const { status: audioStatus } = await Audio.requestPermissionsAsync();
    setHasCameraPermission(cameraStatus === 'granted');
    setHasAudioPermission(audioStatus === 'granted');
    return cameraStatus === 'granted' && audioStatus === 'granted';
  };

  // Monitor BLE state
  useEffect(() => {
    if (!manager) return;
    const sub = manager.onStateChange(state => {
      if (state === 'PoweredOn') {
        addToLog('Bluetooth powered on');
        sub.remove();
      } else {
        addToLog(`Bluetooth state: ${state}`);
      }
    }, true);
    return () => sub.remove();
  }, [manager]);

  // Connect to BLE device named MFA_Demo
  const connectToBLEDevice = async () => {
    try {
      const perms = await requestPermissions();
      if (!perms) return;
      const camAudio = await requestCameraAndAudioPermissions();
      if (!camAudio) return;
      addToLog('Scanning for BLE devices...');
      manager.startDeviceScan(null, null, async (error, scanned) => {
        if (error) {
          addToLog(`Scan error: ${error.message}`);
          return;
        }
        if (!scanned) return;
        if (scanned.name === 'MFA_Demo') {
          manager.stopDeviceScan();
          addToLog(`Found device: ${scanned.name}`);
          try {
            const dev = await manager.connectToDevice(scanned.id);
            await dev.discoverAllServicesAndCharacteristics();
            setDevice(dev);
            setIsConnected(true);
            addToLog('Connected and services discovered');
            const sub = dev.monitorCharacteristicForService(
              BIOMETRIC_SERVICE_UUID,
              AUTH_RESULT_CHAR_UUID,
              (err, char) => {
                if (err) {
                  addToLog(`Notification error: ${err.message}`);
                  return;
                }
                const base64 = char?.value;
                if (!base64) return;
                const decoded = atob(base64);
                const bytes = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
                if (bytes[0] === START_BYTE && bytes[bytes.length - 1] === END_BYTE) {
                  const code = bytes[1];
                  const msg =
                    code === 0x01 ? 'Enrollment Successful' :
                      code === 0x02 ? 'Authentication Successful' :
                        code === 0xf1 ? 'Enrollment Failed' :
                          code === 0xf2 ? 'Authentication Failed' :
                            'Unknown Result';
                  addToLog(`Device Result: ${msg}`);
                  Alert.alert('Device Result', msg);
                }
              }
            );
            setMonitorSubscription(sub);
            addToLog('Started monitoring device notifications');
            Alert.alert('Success', 'Connected to MFA_Demo');
          } catch (connErr) {
            addToLog(`Connection error: ${connErr.message}`);
            Alert.alert('Connection Error', connErr.message);
            setDevice(null);
            setIsConnected(false);
          }
        }
      });
    } catch (e) {
      addToLog(`Unexpected error: ${e.message}`);
      Alert.alert('Error', e.message);
    }
  };

  const disconnectFromBLEDevice = async () => {
    if (device) {
      try {
        if (monitorSubscription) {
          monitorSubscription.remove();
          setMonitorSubscription(null);
        }
        await device.cancelConnection();
        setDevice(null);
        setIsConnected(false);
        addToLog('Disconnected from device');
      } catch (e) {
        addToLog(`Disconnection error: ${e.message}`);
      }
    }
  };

  const arrayToBase64 = (arr) => btoa(String.fromCharCode.apply(null, arr));

  // Placeholder biometric capture functions
  const captureFace = async () => {
    if (!hasCameraPermission) throw new Error('Camera permission not granted');
    return `face_${Date.now()}`;
  };
  const captureVoice = async () => {
    if (!hasAudioPermission) throw new Error('Audio permission not granted');
    return `voice_${Date.now()}`;
  };
  const captureGesture = async () => `gesture_${Date.now()}`;

  const sendChunked = async (data, cmd, charUuid) => {
    if (!device) throw new Error('No device connected');
    const bytes = new Uint8Array(data.split('').map(c => c.charCodeAt(0)));
    const CHUNK = 18;
    const total = Math.ceil(bytes.length / CHUNK);
    const start = new Uint8Array([START_BYTE, cmd, total]);
    await device.writeCharacteristicWithoutResponseForService(BIOMETRIC_SERVICE_UUID, charUuid, arrayToBase64(start));
    for (let i = 0; i < total; i++) {
      const s = i * CHUNK;
      const e = Math.min(s + CHUNK, bytes.length);
      const chunk = bytes.slice(s, e);
      const frame = new Uint8Array(chunk.length + 2);
      frame[0] = START_BYTE;
      frame[frame.length - 1] = END_BYTE;
      frame.set(chunk, 1);
      await device.writeCharacteristicWithoutResponseForService(BIOMETRIC_SERVICE_UUID, charUuid, arrayToBase64(frame));
    }
    const end = new Uint8Array([END_BYTE, 0, 0]);
    await device.writeCharacteristicWithoutResponseForService(BIOMETRIC_SERVICE_UUID, charUuid, arrayToBase64(end));
  };

  const enroll = async () => {
    if (!userName.trim()) { Alert.alert('Error', 'Enter username'); return; }
    if (!device) { Alert.alert('Error', 'Connect to device first'); return; }
    if (!supabase) { Alert.alert('Error', 'Supabase not initialized'); return; }
    setIsEnrolling(true);
    addToLog(`Enrolling ${userName}`);
    try {
      const face = await captureFace();
      const voice = await captureVoice();
      const gesture = await captureGesture();
      await sendChunked(face, CMD_ENROLL, FACE_DATA_CHAR_UUID);
      await sendChunked(voice, CMD_ENROLL, VOICE_DATA_CHAR_UUID);
      await sendChunked(gesture, CMD_ENROLL, GESTURE_DATA_CHAR_UUID);
      const trigger = new Uint8Array([START_BYTE, CMD_ENROLL, 0x00, END_BYTE]);
      await device.writeCharacteristicWithoutResponseForService(BIOMETRIC_SERVICE_UUID, TRIGGER_CHAR_UUID, arrayToBase64(trigger));
      const { error } = await supabase.from('enrollments').insert({ user_name: userName, face_vector: face, voice_vector: voice, gesture_vector: gesture });
      if (error) throw new Error(`Database error: ${error.message}`);
      addToLog(`User ${userName} enrolled`);
      Alert.alert('Success', `User ${userName} enrolled`);
    } catch (e) {
      addToLog(`Enroll error: ${e.message}`);
      Alert.alert('Error', e.message);
    } finally { setIsEnrolling(false); }
  };

  const authenticate = async () => {
    if (!userName.trim()) { Alert.alert('Error', 'Enter username'); return; }
    if (!device) { Alert.alert('Error', 'Connect to device first'); return; }
    if (!supabase) { Alert.alert('Error', 'Supabase not initialized'); return; }
    setIsAuthenticating(true);
    addToLog(`Authenticating ${userName}`);
    try {
      const face = await captureFace();
      const voice = await captureVoice();
      const gesture = await captureGesture();
      await sendChunked(face, CMD_AUTHENTICATE, FACE_DATA_CHAR_UUID);
      await sendChunked(voice, CMD_AUTHENTICATE, VOICE_DATA_CHAR_UUID);
      await sendChunked(gesture, CMD_AUTHENTICATE, GESTURE_DATA_CHAR_UUID);
      const trigger = new Uint8Array([START_BYTE, CMD_AUTHENTICATE, 0x00, END_BYTE]);
      await device.writeCharacteristicWithoutResponseForService(BIOMETRIC_SERVICE_UUID, TRIGGER_CHAR_UUID, arrayToBase64(trigger));
      const { data, error } = await supabase.from('enrollments').select('*').eq('user_name', userName).single();
      if (error && error.code !== 'PGRST116') throw new Error(`Database error: ${error.message}`);
      if (data) {
        addToLog(`User ${userName} authenticated`);
        Alert.alert('Success', `User ${userName} authenticated`);
      } else {
        addToLog(`User ${userName} not found`);
        Alert.alert('Failed', `User ${userName} not found`);
      }
    } catch (e) {
      addToLog(`Auth error: ${e.message}`);
      Alert.alert('Error', e.message);
    } finally { setIsAuthenticating(false); }
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
          <Text style={styles.buttonText}>{isConnected ? 'Disconnect' : 'Connect'}</Text>
        </TouchableOpacity>
        <Text style={styles.status}>Status: {isConnected ? 'Connected' : 'Disconnected'}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>User Management</Text>
        <TextInput style={styles.input} placeholder="Username" value={userName} onChangeText={setUserName} />
        <View style={styles.row}>
          <TouchableOpacity style={[styles.button, styles.enroll]} onPress={enroll} disabled={!isConnected || isEnrolling || isAuthenticating}>
            <Text style={styles.buttonText}>{isEnrolling ? 'Enrolling...' : 'Enroll'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.auth]} onPress={authenticate} disabled={!isConnected || isEnrolling || isAuthenticating}>
            <Text style={styles.buttonText}>{isAuthenticating ? 'Authenticating...' : 'Authenticate'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Log</Text>
        {log.map((l, i) => (<Text key={i} style={styles.log}>{l}</Text>))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 20, color: '#333' },
  section: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  button: { padding: 12, borderRadius: 8, alignItems: 'center', marginVertical: 5 },
  connectButton: { backgroundColor: '#4caf50' },
  disconnectButton: { backgroundColor: '#f44336' },
  enroll: { backgroundColor: '#2196f3', flex: 1, marginRight: 5 },
  auth: { backgroundColor: '#ff9800', flex: 1, marginLeft: 5 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  status: { textAlign: 'center', marginTop: 8, color: '#666' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  log: { fontSize: 12, color: '#555', marginBottom: 4 },
});

export default App;