import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, ShieldCheck, Fingerprint } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const handleEnroll = () => {
    navigate("/capture", { state: { mode: "enroll" } });
  };

  const handleAuthenticate = () => {
    navigate("/capture", { state: { mode: "authenticate" } });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
            <Fingerprint className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Multi-Modal Biometric Authentication
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Secure authentication using facial recognition, voice authentication, and gesture recognition
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          <Card className="p-6 md:p-8 hover:shadow-lg transition-shadow bg-card">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <UserPlus className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-3">Enroll New User</h2>
                <p className="text-muted-foreground mb-6">
                  Register a new user by capturing facial features, voice pattern, and gesture signature
                </p>
              </div>
              <Button 
                onClick={handleEnroll}
                size="lg"
                className="w-full"
              >
                Start Enrollment
              </Button>
            </div>
          </Card>

          <Card className="p-6 md:p-8 hover:shadow-lg transition-shadow bg-card">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                <ShieldCheck className="h-8 w-8 text-accent" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-3">Authenticate User</h2>
                <p className="text-muted-foreground mb-6">
                  Verify identity using multi-modal biometric authentication with Arduino BLE
                </p>
              </div>
              <Button 
                onClick={handleAuthenticate}
                size="lg"
                variant="outline"
                className="w-full"
              >
                Start Authentication
              </Button>
            </div>
          </Card>
        </div>

        <div className="mt-8 md:mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 bg-muted/50 border-none">
            <div className="text-center">
              <h3 className="font-semibold mb-1">Face Recognition</h3>
              <p className="text-sm text-muted-foreground">High-accuracy facial biometric capture</p>
            </div>
          </Card>
          <Card className="p-4 bg-muted/50 border-none">
            <div className="text-center">
              <h3 className="font-semibold mb-1">Voice Authentication</h3>
              <p className="text-sm text-muted-foreground">Unique voice pattern analysis</p>
            </div>
          </Card>
          <Card className="p-4 bg-muted/50 border-none">
            <div className="text-center">
              <h3 className="font-semibold mb-1">Gesture Recognition</h3>
              <p className="text-sm text-muted-foreground">Custom gesture signature detection</p>
            </div>
          </Card>
        </div>

        <div className="mt-8 p-6 bg-primary/5 rounded-lg border border-primary/10">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            BLE Integration with Arduino Nano BLE Rev2
          </h3>
          <p className="text-sm text-muted-foreground">
            This app uses Web Bluetooth API to connect with Arduino Nano BLE Rev2 for secure biometric data transmission and authentication processing. Ensure your device supports BLE and the app is served over HTTPS.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;