import { EstateSalesScraper } from "@/components/EstateSalesScraper";
import heroImage from "@/assets/estate-sales-hero.jpg";
import { Gem, MapPin, Clock } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-secondary/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 to-background/95" />
        
        <div className="relative container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-vintage-gold to-estate-red rounded-full flex items-center justify-center shadow-lg">
                <Gem className="w-12 h-12 text-primary-foreground" />
              </div>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-foreground">
              Michigan
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-vintage-gold to-estate-red"> Grand</span> Finds
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Discover hidden treasures and vintage gems at estate sales across Michigan
            </p>
            
            <div className="flex flex-wrap justify-center gap-6 mb-12">
              <div className="flex items-center gap-2 text-treasure-green">
                <MapPin className="w-5 h-5" />
                <span className="font-medium">Michigan Focused</span>
              </div>
              <div className="flex items-center gap-2 text-antique-brown">
                <Clock className="w-5 h-5" />
                <span className="font-medium">Real-time Updates</span>
              </div>
              <div className="flex items-center gap-2 text-estate-red">
                <Gem className="w-5 h-5" />
                <span className="font-medium">Hidden Treasures</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-16">
        <EstateSalesScraper />
      </div>
      
      {/* Footer */}
      <footer className="bg-card/50 border-t border-border py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            Start exploring estate sales in Grand Blanc and discover your next treasure
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
