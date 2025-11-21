import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Check, Square } from "lucide-react";

interface VoiceCaptureProps {
  onCapture: (data: string) => void;
  captured: boolean;
}

export const VoiceCapture = ({ onCapture, captured }: VoiceCaptureProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        
        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          onCapture(base64);
        };
        reader.readAsDataURL(blob);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          stopRecording();
        }
      }, 5000);
    } catch (error: any) {
      console.error("Microphone access denied:", error);
      alert(`Microphone access is required for voice capture. Error: ${error.message || error}`);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <Card className="p-6 bg-card">
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
          captured ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"
        }`}>
          {captured ? <Check className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg mb-2">Voice Authentication</h3>
          
          {!isRecording && !audioURL && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Record 3-5 seconds of your voice for authentication
              </p>
              <Button onClick={startRecording} variant="outline" className="w-full sm:w-auto">
                <Mic className="mr-2 h-4 w-4" />
                Start Recording
              </Button>
            </div>
          )}

          {isRecording && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse" style={{ width: "100%" }} />
                </div>
                <span className="text-sm text-muted-foreground">Recording...</span>
              </div>
              <Button onClick={stopRecording} variant="outline" className="w-full sm:w-auto">
                <Square className="mr-2 h-4 w-4" />
                Stop Recording
              </Button>
            </div>
          )}

          {audioURL && (
            <div className="space-y-4">
              <audio src={audioURL} controls className="w-full max-w-md" />
              <Button 
                onClick={() => {
                  setAudioURL(null);
                  startRecording();
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
