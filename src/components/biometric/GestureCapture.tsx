import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hand, Check, Circle } from "lucide-react";

interface GestureCaptureProps {
  onCapture: (data: string) => void;
  captured: boolean;
}

export const GestureCapture = ({ onCapture, captured }: GestureCaptureProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startCamera = async () => {
    try {
      console.log("=== STARTING GESTURE CAMERA ===");
      
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Clear previous preview and reset states
      setPreview(null);
      setDebugInfo("");
      
      // Request camera access
      console.log("Requesting gesture camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      
      console.log("Gesture camera access granted");
      streamRef.current = stream;
      
      if (videoRef.current) {
        console.log("Setting gesture video source");
        videoRef.current.srcObject = stream;
        
        // Set video element properties
        videoRef.current.autoplay = true;
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        
        // Add debugging info
        setTimeout(() => {
          if (videoRef.current) {
            const info = `Ready: ${videoRef.current.readyState}, 
                         Size: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`;
            setDebugInfo(info);
          }
        }, 1000);
      }
      
      setIsRecording(true);
      console.log("Gesture camera started successfully");
      
      // Start recording after a short delay
      setTimeout(() => {
        console.log("Starting gesture recording");
        startRecording(stream);
      }, 1000);
    } catch (error: any) {
      console.error("Gesture camera error:", error);
      setDebugInfo(`Camera error: ${error.message || error}`);
      alert(`Gesture camera error: ${error.message || error}`);
      setIsRecording(false);
    }
  };

  const startRecording = (stream: MediaStream) => {
    try {
      console.log("=== STARTING GESTURE RECORDING ===");
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        console.log("Gesture data available, size:", e.data?.size || 0);
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log("=== GESTURE RECORDING STOPPED ===");
        console.log("Gesture recording stopped, chunks:", chunksRef.current.length);
        try {
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: "video/webm" });
            console.log("Blob created, size:", blob.size);
            
            // Convert to base64
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              console.log("Gesture recording processed, base64 size:", base64.length);
              
              setPreview(base64);
              onCapture(base64);
              
              // Automatically stop the camera after recording is complete
              stopCamera();
            };
            reader.readAsDataURL(blob);
          } else {
            console.warn("No gesture data captured");
            alert("No gesture data recorded");
          }
        } catch (error) {
          console.error("Error processing gesture recording:", error);
          alert("Error processing gesture recording");
        }
      };
      
      mediaRecorder.start();
      console.log("MediaRecorder started");
      
      // Auto-stop after 2 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          console.log("Auto-stopping gesture recording");
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        }
      }, 2000);
    } catch (error) {
      console.error("Error starting gesture recording:", error);
      alert("Error starting gesture recording");
      setIsRecording(false);
    }
  };

  const stopCamera = () => {
    console.log("=== STOPPING GESTURE CAMERA ===");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log("Stopping gesture track:", track.kind);
        track.stop();
      });
      streamRef.current = null;
    }
    setDebugInfo("");
  };

  return (
    <Card className="p-6 bg-card">
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
          captured ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"
        }`}>
          {captured ? <Check className="h-6 w-6" /> : <Hand className="h-6 w-6" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg mb-2">Gesture Recognition</h3>
          
          {!isRecording && !preview && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Record a 1-2 second hand gesture or pattern for authentication
              </p>
              <Button onClick={startCamera} variant="outline" className="w-full sm:w-auto">
                <Hand className="mr-2 h-4 w-4" />
                Start Recording
              </Button>
            </div>
          )}
          
          {isRecording && (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-gray-800 aspect-video max-w-md">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ 
                    backgroundColor: '#1f2937'
                  }}
                />
                <div className="absolute inset-0 border-2 border-red-500 rounded-lg pointer-events-none"></div>
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-destructive/90 text-destructive-foreground px-3 py-1 rounded-full">
                  <Circle className="h-3 w-3 fill-current animate-pulse" />
                  <span className="text-sm font-medium">Recording</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={stopCamera} variant="outline">
                  Cancel
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Perform your gesture now... (auto-stops in 2s)
              </p>
              {debugInfo && (
                <p className="text-sm bg-info/10 p-2 rounded">
                  Status: {debugInfo}
                </p>
              )}
            </div>
          )}
          
          {preview && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden bg-muted aspect-video max-w-md">
                <video 
                  src={preview} 
                  controls 
                  className="w-full h-full object-cover"
                />
              </div>
              <Button 
                onClick={() => {
                  setPreview(null);
                  startCamera();
                }} 
                variant="outline"
                className="w-full sm:w-auto"
              >
                Re-record
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};