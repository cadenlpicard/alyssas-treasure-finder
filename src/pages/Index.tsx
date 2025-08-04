import { EstateSalesScraper } from "@/components/EstateSalesScraper";
import heroImage from "@/assets/estate-sales-hero.jpg";
import { Gem, MapPin, Clock } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/10">
      {/* Hero Section */}
      <div className="relative h-screen flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/70 to-background/50" />
        
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto animate-fade-in">
          {/* Icon Badge */}
          <div className="flex justify-center mb-8 animate-scale-in">
            <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center shadow-2xl ring-4 ring-primary/20">
              <Gem className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold mb-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <span className="text-foreground">Estate Sale</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-primary/60"> Finder</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: '0.4s' }}>
            Discover hidden treasures and vintage gems at estate sales with intelligent route planning
          </p>
          
          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-4 mb-8 animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <div className="group flex items-center gap-3 bg-card/80 backdrop-blur-sm border border-border/50 rounded-full px-6 py-3 hover-scale transition-all duration-300 hover:shadow-lg">
              <MapPin className="w-5 h-5 text-primary transition-transform group-hover:scale-110" />
              <span className="text-sm font-medium">Location Search</span>
            </div>
            <div className="group flex items-center gap-3 bg-card/80 backdrop-blur-sm border border-border/50 rounded-full px-6 py-3 hover-scale transition-all duration-300 hover:shadow-lg">
              <Clock className="w-5 h-5 text-primary transition-transform group-hover:scale-110" />
              <span className="text-sm font-medium">Real-time Updates</span>
            </div>
            <div className="group flex items-center gap-3 bg-card/80 backdrop-blur-sm border border-border/50 rounded-full px-6 py-3 hover-scale transition-all duration-300 hover:shadow-lg">
              <Gem className="w-5 h-5 text-primary transition-transform group-hover:scale-110" />
              <span className="text-sm font-medium">Hidden Treasures</span>
            </div>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-[bounce_2s_infinite]">
          <div className="w-6 h-10 border-2 border-muted-foreground/40 rounded-full p-1">
            <div className="w-1 h-3 bg-muted-foreground/40 rounded-full mx-auto animate-[bounce_2s_infinite]"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 -mt-24 pb-20">
        <div className="container mx-auto px-4">
          <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-3xl shadow-2xl overflow-hidden animate-slide-in-right">
            <EstateSalesScraper />
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-lg">
            Start your treasure hunting adventure at estate sales nationwide
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
