import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import pirateImage from "@/assets/pirate-guard.jpg";
import { createLogger } from "@/lib/logger";

interface PasscodeWindowProps {
  onPasscodeCorrect: () => void;
}

export const PasscodeWindow = ({ onPasscodeCorrect }: PasscodeWindowProps) => {
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const logger = createLogger('PasscodeWindow');

  // Secret passcode - you can change this to whatever you want
  const SECRET_PASSCODE = 'treasure';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    logger.info('Passcode attempt');
    // Add a small delay for dramatic effect
    await new Promise(resolve => setTimeout(resolve, 800));

    if (passcode.toLowerCase() === SECRET_PASSCODE) {
      logger.info('Passcode success');
      toast({
        title: "Access Granted!",
        description: "Welcome aboard, treasure hunter!",
      });
      onPasscodeCorrect();
    } else {
      logger.warn('Passcode failed');
      toast({
        title: "Access Denied",
        description: "Arrr! That's not the right treasure code, matey!",
        variant: "destructive",
      });
      setPasscode('');
    }
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4 z-50">
      {/* Animated background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-blue-400/10 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-purple-400/10 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <Card className="relative w-full max-w-md bg-card/95 backdrop-blur-sm border-2 border-border/50 shadow-2xl animate-fade-in">
        <div className="p-8 text-center space-y-6">
          {/* Pirate Image */}
          <div className="relative mx-auto w-32 h-24 rounded-xl overflow-hidden shadow-lg ring-4 ring-primary/20">
            <img 
              src={pirateImage} 
              alt="Pirate Guard protecting the treasure map" 
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Header */}
          <div className="space-y-2">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center shadow-xl ring-4 ring-primary/20">
                <Lock className="w-8 h-8 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Ahoy There, Matey!
            </h1>
            <p className="text-muted-foreground text-lg">
              Enter the secret treasure code to access Alyssa's Treasure Finder
            </p>
          </div>

          {/* Passcode Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter secret code..."
                className="h-12 text-center text-lg border-2 border-border/50 rounded-xl bg-background/50 backdrop-blur-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-300"
                disabled={isLoading}
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 shadow-lg hover:shadow-xl"
              disabled={isLoading || !passcode.trim()}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                  Checking Code...
                </div>
              ) : (
                "Unlock Treasure Map"
              )}
            </Button>
          </form>

          {/* Hint */}
          <div className="text-sm text-muted-foreground bg-accent/30 rounded-lg p-3 border border-border/30">
            <p className="font-medium mb-1">🏴‍☠️ Pirate's Hint:</p>
            <p>Think about what pirates seek most...</p>
          </div>
        </div>
      </Card>
    </div>
  );
};