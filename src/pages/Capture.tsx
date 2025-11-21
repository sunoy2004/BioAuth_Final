import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bluetooth } from "lucide-react";
import { FaceCapture } from "@/components/biometric/FaceCapture";
import { VoiceCapture } from "@/components/biometric/VoiceCapture";
import { GestureCapture } from "@/components/biometric/GestureCapture";
import { BLEConnection } from "@/components/bluetooth/BLEConnection";
import { toast } from "sonner";

interface BiometricData {
  face: { img1: string; img2: string; img3: string } | null;
  voice: string | null;
  gesture: string | null;
}

const Capture = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = location.state?.mode as "enroll" | "authenticate";
  
  const [biometricData, setBiometricData] = useState<BiometricData>({
    face: null,
    voice: null,
    gesture: null,
  });
  
  const [showBLE, setShowBLE] = useState(false);

  const updateBiometric = (type: keyof BiometricData, data: any) => {
    setBiometricData(prev => ({ ...prev, [type]: data }));
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} captured successfully`);
  };

  const allCaptured = biometricData.face && biometricData.voice && biometricData.gesture;

  const handleConnect = () => {
    if (!allCaptured) {
      toast.error("Please capture all biometric data first");
      return;
    }
    setShowBLE(true);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {mode === "enroll" ? "Enroll New User" : "Authenticate User"}
            </h1>
            <p className="text-muted-foreground mt-1">
              Capture all three biometric features
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <FaceCapture
            onCapture={(data) => updateBiometric("face", data)}
            captured={!!biometricData.face}
          />
          
          <VoiceCapture
            onCapture={(data) => updateBiometric("voice", data)}
            captured={!!biometricData.voice}
          />
          
          <GestureCapture
            onCapture={(data) => updateBiometric("gesture", data)}
            captured={!!biometricData.gesture}
          />
        </div>

        <Card className="p-6 bg-card">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-lg">Ready to Connect</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {allCaptured 
                  ? "All biometric data captured. Connect to Arduino BLE device."
                  : `${Object.values(biometricData).filter(Boolean).length}/3 features captured`
                }
              </p>
            </div>
            <Button
              onClick={handleConnect}
              disabled={!allCaptured}
              className="w-full sm:w-auto"
              size="lg"
            >
              <Bluetooth className="mr-2 h-5 w-5" />
              Connect BLE Device
            </Button>
          </div>
        </Card>

        {showBLE && (
          <BLEConnection
            biometricData={biometricData}
            mode={mode}
            onClose={() => setShowBLE(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Capture;
