# 🏴‍☠️ Alyssa's Treasure Finder

A sophisticated estate sales discovery and route optimization platform that helps treasure hunters find the best deals and plan efficient routes to multiple estate sales.

![Estate Sales Finder](https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=800&h=400&fit=crop)

## ✨ Features

### 🔍 Smart Estate Sales Discovery
- **Location-Based Search**: Find estate sales in any city, state, or ZIP code
- **Radius Filtering**: Search within 5-50 miles or view all available sales
- **Intelligent Deduplication**: Automatically removes duplicate listings
- **Real-Time Scraping**: Uses Firecrawl to gather the latest estate sale data

### 🗺️ Interactive Map View
- **Dual View Modes**: Toggle between list and map views
- **Mapbox Integration**: Beautiful, interactive maps with custom markers
- **Popup Details**: Click markers to see estate sale information
- **Geocoding**: Automatic address-to-coordinates conversion

### 🛣️ Route Optimization
- **Multi-Stop Planning**: Select multiple estate sales for route planning
- **Efficient Routing**: Get optimized directions to visit all selected sales
- **Distance Calculations**: See distances and estimated travel times

### 🔐 Security Features
- **Passcode Protection**: Pirate-themed access control
- **Secure Backend**: Supabase integration with Row Level Security

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (Database, Auth, Edge Functions)
- **Maps**: Mapbox GL JS
- **Web Scraping**: Firecrawl API
- **Routing**: React Router DOM
- **State Management**: React Query (TanStack Query)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Mapbox account
- Firecrawl API account

### Installation

1. **Clone the repository**
   ```bash
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Configure Supabase Edge Function Secrets**
   
   Add these secrets in your Supabase dashboard under Edge Functions:
   ```
   MAPBOX_ACCESS_TOKEN=your_mapbox_public_token
   FIRECRAWL_API_KEY=your_firecrawl_api_key
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## ⚙️ Configuration

### Supabase Setup

1. Create a new Supabase project
2. Update the environment variables with your project details
3. Deploy the Edge Functions:
   ```bash
   supabase functions deploy firecrawl-scrape
   supabase functions deploy get-mapbox-token
   supabase functions deploy optimize-route
   ```

### Mapbox Setup

1. Create a Mapbox account at [mapbox.com](https://mapbox.com)
2. Get your public access token from the dashboard
3. Add the token to your Supabase Edge Function secrets

### Firecrawl Setup

1. Sign up for Firecrawl at [firecrawl.dev](https://firecrawl.dev)
2. Get your API key from the dashboard
3. Add the API key to your Supabase Edge Function secrets

## 🎯 Usage

### Accessing the Application

1. Navigate to the application URL
2. Enter the secret passcode: `treasure`
3. You'll be taken to the main estate sales finder interface

### Finding Estate Sales

1. **Select Location**: Use the location input to choose your search area
2. **Set Radius**: Choose how far you want to search (5-50 miles)
3. **Search**: Click "Discover Estate Sales" to find available sales
4. **View Results**: Toggle between list and map views

### Planning Routes

1. **Select Sales**: Check the boxes next to estate sales you want to visit
2. **Plan Route**: Click the "Plan Route" button when you have 2+ selections
3. **Get Directions**: View the optimized route with turn-by-turn directions

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── EstateSaleCard.tsx     # Individual estate sale display
│   ├── EstateSalesScraper.tsx # Main application component
│   ├── LocationInput.tsx     # Location search input
│   ├── MapView.tsx           # Mapbox map integration
│   ├── PasscodeWindow.tsx    # Security access control
│   └── RouteOptimizationDialog.tsx # Route planning modal
├── pages/
│   ├── Index.tsx             # Main page
│   └── NotFound.tsx          # 404 page
├── utils/
│   └── FirecrawlService.ts   # Web scraping service
├── integrations/
│   └── supabase/             # Supabase configuration
└── assets/                   # Images and static files
```

## 🔧 Edge Functions

### firecrawl-scrape
Handles web scraping of estate sale websites using the Firecrawl API.

### get-mapbox-token
Securely provides Mapbox access tokens to the frontend.

### optimize-route
Calculates optimal routes between multiple estate sale locations.

## 🎨 Design System

The application uses a custom design system built on Tailwind CSS with:
- Semantic color tokens defined in `index.css`
- Custom component variants in `tailwind.config.ts`
- Responsive design patterns
- Dark/light mode support

## 🚀 Deployment

### Using Lovable (Recommended)

1. Open your [Lovable Project](https://lovable.dev/projects/d4e415c8-35e9-4f6b-87c0-0ac6fbe20ff2)
2. Click "Share" → "Publish"
3. Your app will be deployed automatically

### Manual Deployment

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy the `dist` folder to your hosting platform of choice

3. Ensure environment variables are configured in your hosting platform

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes |

### Edge Function Secrets (in Supabase)

| Secret | Description | Required |
|--------|-------------|----------|
| `MAPBOX_ACCESS_TOKEN` | Mapbox public access token | Yes |
| `FIRECRAWL_API_KEY` | Firecrawl API key for web scraping | Yes |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you need help:
1. Check the [Lovable Documentation](https://docs.lovable.dev/)
2. Join the [Lovable Discord Community](https://discord.com/channels/1119885301872070706/1280461670979993613)
3. Create an issue in this repository

## 🙏 Acknowledgments

- Built with [Lovable](https://lovable.dev)
- Maps powered by [Mapbox](https://mapbox.com)
- Web scraping by [Firecrawl](https://firecrawl.dev)
- Backend by [Supabase](https://supabase.com)
- UI components by [shadcn/ui](https://ui.shadcn.com)