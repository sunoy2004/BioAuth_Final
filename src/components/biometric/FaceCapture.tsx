import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Check } from "lucide-react";

interface FaceCaptureProps {
  onCapture: (data: { img1: string; img2: string; img3: string }) => void;
  captured: boolean;
}

export const FaceCapture = ({ onCapture, captured }: FaceCaptureProps) => {
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const streamRef = useRef<MediaStream | null>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      console.log("=== STARTING CAMERA (DIRECT CAPTURE) ===");
      
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Clear previous images
      setCapturedImages([]);
      setDebugInfo("");
      
      // Request camera access
      console.log("Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      
      console.log("Camera access granted");
      streamRef.current = stream;
      currentStreamRef.current = stream;
      
      setIsCapturing(true);
      console.log("Camera started successfully");
      
      // Set debug info
      setDebugInfo("Camera ready - click capture to take photo");
    } catch (error: any) {
      console.error("Camera error:", error);
      setDebugInfo(`Camera error: ${error.message || error}`);
      alert(`Camera error: ${error.message || error}`);
      setIsCapturing(false);
    }
  };

  const captureImage = async () => {
    console.log("=== CAPTURE IMAGE CLICKED (DIRECT) ===");
    
    if (!currentStreamRef.current) {
      alert("No camera stream available");
      return;
    }
    
    try {
      // Create a temporary video element to capture from stream
      const video = document.createElement('video');
      video.srcObject = currentStreamRef.current;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      
      // Wait a moment for video to initialize
      await new Promise(resolve => {
        video.onloadeddata = () => {
          console.log("Video loaded data");
          resolve(null);
        };
        // Timeout fallback
        setTimeout(resolve, 1000);
      });
      
      // Try to play the video
      try {
        await video.play();
        console.log("Temporary video playing");
      } catch (playError) {
        console.log("Could not play temporary video:", playError);
      }
      
      // Create canvas and capture
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      
      // Draw a background
      ctx.fillStyle = "#4F46E5";
      ctx.fillRect(0, 0, 640, 480);
      
      // Try to draw video frame
      let captureSuccess = false;
      try {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          ctx.drawImage(video, 0, 0, 640, 480);
          captureSuccess = true;
          console.log("Video frame captured successfully");
        }
      } catch (drawError) {
        console.log("Could not draw video frame:", drawError);
      }
      
      // Add debug info
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "16px Arial";
      ctx.fillText(captureSuccess ? "✓ DIRECT CAPTURE" : "✗ NO VIDEO DATA", 20, 30);
      ctx.fillText(`Video: ${video.videoWidth}x${video.videoHeight}`, 20, 60);
      
      // Clean up video element
      video.remove();
      
      // Convert to base64
      const base64 = canvas.toDataURL("image/jpeg", 0.8);
      
      // Add to captured images
      const newImages = [...capturedImages, base64];
      setCapturedImages(newImages);
      
      // If we have 3 images, complete capture
      if (newImages.length === 3) {
        onCapture({
          img1: newImages[0],
          img2: newImages[1],
          img3: newImages[2]
        });
        stopCamera();
      }
      
    } catch (error) {
      console.error("Capture error:", error);
      setDebugInfo(`Capture error: ${error.message || error}`);
      alert(`Capture error: ${error.message || error}`);
    }
  };

  const stopCamera = () => {
    console.log("=== STOPPING CAMERA ===");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (currentStreamRef.current) {
      currentStreamRef.current = null;
    }
    setIsCapturing(false);
    setDebugInfo("");
    console.log("Camera stopped");
  };

  const resetCapture = () => {
    console.log("=== RESETTING CAPTURE ===");
    stopCamera();
    setCapturedImages([]);
    startCamera();
  };

  return (
    <Card className="p-6 bg-card">
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
          captured ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"
        }`}>
          {captured ? <Check className="h-6 w-6" /> : <Camera className="h-6 w-6" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg mb-2">
            Facial Recognition {capturedImages.length > 0 && `(${capturedImages.length}/3)`}
          </h3>
          
          {!isCapturing && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Capture 3 clear photos of your face for biometric authentication
              </p>
              <Button onClick={startCamera} variant="outline" className="w-full sm:w-auto">
                <Camera className="mr-2 h-4 w-4" />
                {capturedImages.length > 0 ? "Continue Capture" : "Start Camera"}
              </Button>
            </div>
          )}
          
          {isCapturing && (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-gray-800 aspect-video max-w-md flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Camera className="h-12 w-12 mx-auto mb-2" />
                  <p>Camera Active</p>
                  <p className="text-sm">Point your camera at your face</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={captureImage} 
                  className="flex-1 sm:flex-initial"
                >
                  Capture Image {capturedImages.length + 1}
                </Button>
                <Button onClick={stopCamera} variant="outline">
                  Cancel
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Click capture to take a photo directly from camera
              </p>
              {debugInfo && (
                <p className="text-sm bg-info/10 p-2 rounded">
                  Status: {debugInfo}
                </p>
              )}
              {capturedImages.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <p className="text-sm text-muted-foreground w-full">
                    Captured Images ({capturedImages.length}/3):
                  </p>
                  {capturedImages.map((img, idx) => (
                    <div key={idx} className="w-16 h-16 rounded border-2 border-success overflow-hidden">
                      <img src={img} alt={`Capture ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {capturedImages.length === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-success">✓ All 3 images captured successfully</p>
              <div className="flex gap-2 flex-wrap">
                {capturedImages.map((img, idx) => (
                  <div key={idx} className="w-24 h-24 rounded border-2 border-success overflow-hidden">
                    <img src={img} alt={`Capture ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <Button 
                onClick={resetCapture} 
                variant="outline"
                className="w-full sm:w-auto"
              >
                Retake All
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};