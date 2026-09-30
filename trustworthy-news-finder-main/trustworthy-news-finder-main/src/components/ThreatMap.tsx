import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Globe, AlertTriangle, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ThreatLocation {
  id: string;
  domain: string;
  latitude: number;
  longitude: number;
  riskLevel: string;
  threatCount: number;
  country: string;
  city?: string;
}

// Sample threat data with geographic distribution
// In a real app, this would come from threat intelligence APIs
const generateThreatData = (): ThreatLocation[] => {
  const threatLocations: ThreatLocation[] = [
    // Known threat hotspots
    { id: '1', domain: 'malware-host.xyz', latitude: 55.7558, longitude: 37.6173, riskLevel: 'critical', threatCount: 45, country: 'Russia', city: 'Moscow' },
    { id: '2', domain: 'phishing-site.top', latitude: 31.2304, longitude: 121.4737, riskLevel: 'high', threatCount: 32, country: 'China', city: 'Shanghai' },
    { id: '3', domain: 'scam-domain.click', latitude: 23.1291, longitude: 113.2644, riskLevel: 'critical', threatCount: 28, country: 'China', city: 'Guangzhou' },
    { id: '4', domain: 'fake-login.work', latitude: 52.5200, longitude: 13.4050, riskLevel: 'medium', threatCount: 15, country: 'Germany', city: 'Berlin' },
    { id: '5', domain: 'crypto-scam.io', latitude: 51.5074, longitude: -0.1278, riskLevel: 'high', threatCount: 22, country: 'UK', city: 'London' },
    { id: '6', domain: 'ransomware-c2.net', latitude: 50.4501, longitude: 30.5234, riskLevel: 'critical', threatCount: 38, country: 'Ukraine', city: 'Kyiv' },
    { id: '7', domain: 'botnet-controller.org', latitude: 55.6761, longitude: 12.5683, riskLevel: 'high', threatCount: 19, country: 'Denmark', city: 'Copenhagen' },
    { id: '8', domain: 'spam-relay.biz', latitude: 40.7128, longitude: -74.0060, riskLevel: 'medium', threatCount: 12, country: 'USA', city: 'New York' },
    { id: '9', domain: 'credential-stealer.ru', latitude: 59.9311, longitude: 30.3609, riskLevel: 'critical', threatCount: 41, country: 'Russia', city: 'St. Petersburg' },
    { id: '10', domain: 'fake-bank.com.br', latitude: -23.5505, longitude: -46.6333, riskLevel: 'high', threatCount: 25, country: 'Brazil', city: 'São Paulo' },
    { id: '11', domain: 'exploit-kit.asia', latitude: 35.6762, longitude: 139.6503, riskLevel: 'medium', threatCount: 18, country: 'Japan', city: 'Tokyo' },
    { id: '12', domain: 'adware-cdn.xyz', latitude: 19.4326, longitude: -99.1332, riskLevel: 'low', threatCount: 8, country: 'Mexico', city: 'Mexico City' },
    { id: '13', domain: 'dropper-server.net', latitude: 48.8566, longitude: 2.3522, riskLevel: 'high', threatCount: 21, country: 'France', city: 'Paris' },
    { id: '14', domain: 'keylogger-host.info', latitude: 41.9028, longitude: 12.4964, riskLevel: 'critical', threatCount: 33, country: 'Italy', city: 'Rome' },
    { id: '15', domain: 'mining-pool.ru', latitude: 56.8389, longitude: 60.6057, riskLevel: 'medium', threatCount: 14, country: 'Russia', city: 'Yekaterinburg' },
  ];
  
  return threatLocations;
};

export function ThreatMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threatData, setThreatData] = useState<ThreatLocation[]>([]);
  const [selectedThreat, setSelectedThreat] = useState<ThreatLocation | null>(null);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  });

  // Fetch Mapbox token from edge function
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapToken(data.token);
        } else {
          setError('Mapbox token not configured');
        }
      } catch (err) {
        console.error('Failed to fetch Mapbox token:', err);
        setError('Failed to load map configuration');
      }
    };
    
    fetchToken();
  }, []);

  // Initialize map when token is available
  useEffect(() => {
    if (!mapContainer.current || !mapToken) return;

    try {
      mapboxgl.accessToken = mapToken;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        projection: 'globe',
        zoom: 1.5,
        center: [20, 30],
        pitch: 30,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      map.current.on('style.load', () => {
        map.current?.setFog({
          color: 'rgb(20, 20, 30)',
          'high-color': 'rgb(40, 40, 60)',
          'horizon-blend': 0.3,
        });
      });

      // Load threat data
      const threats = generateThreatData();
      setThreatData(threats);
      
      // Calculate stats
      const newStats = {
        total: threats.length,
        critical: threats.filter(t => t.riskLevel === 'critical').length,
        high: threats.filter(t => t.riskLevel === 'high').length,
        medium: threats.filter(t => t.riskLevel === 'medium').length,
        low: threats.filter(t => t.riskLevel === 'low').length
      };
      setStats(newStats);

      // Add markers after map loads
      map.current.on('load', () => {
        threats.forEach(threat => {
          const color = threat.riskLevel === 'critical' ? '#ef4444' :
                        threat.riskLevel === 'high' ? '#fb923c' :
                        threat.riskLevel === 'medium' ? '#facc15' : '#2dd4bf';
          
          const size = threat.riskLevel === 'critical' ? 20 :
                       threat.riskLevel === 'high' ? 16 :
                       threat.riskLevel === 'medium' ? 12 : 8;

          const el = document.createElement('div');
          el.className = 'threat-marker';
          el.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: 50%;
            border: 2px solid white;
            cursor: pointer;
            box-shadow: 0 0 ${size}px ${color}80;
            animation: pulse 2s infinite;
          `;

          const marker = new mapboxgl.Marker(el)
            .setLngLat([threat.longitude, threat.latitude])
            .addTo(map.current!);

          el.addEventListener('click', () => {
            setSelectedThreat(threat);
            map.current?.flyTo({
              center: [threat.longitude, threat.latitude],
              zoom: 4,
              duration: 1500
            });
          });
        });

        setLoading(false);
      });

      // Slow rotation
      const secondsPerRevolution = 300;
      let userInteracting = false;

      function spinGlobe() {
        if (!map.current) return;
        const zoom = map.current.getZoom();
        if (!userInteracting && zoom < 3) {
          const distancePerSecond = 360 / secondsPerRevolution;
          const center = map.current.getCenter();
          center.lng -= distancePerSecond / 60;
          map.current.easeTo({ center, duration: 1000, easing: (n) => n });
        }
      }

      map.current.on('mousedown', () => { userInteracting = true; });
      map.current.on('mouseup', () => { userInteracting = false; spinGlobe(); });
      map.current.on('moveend', spinGlobe);
      
      spinGlobe();

    } catch (err) {
      console.error('Map initialization error:', err);
      setError('Failed to initialize map');
      setLoading(false);
    }

    return () => {
      map.current?.remove();
    };
  }, [mapToken]);

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const refreshData = () => {
    setLoading(true);
    const threats = generateThreatData();
    setThreatData(threats);
    setTimeout(() => setLoading(false), 1000);
  };

  if (error) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please configure your Mapbox token in the backend settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <Globe className="h-5 w-5 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Threats</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{stats.critical}</div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">{stats.high}</div>
            <div className="text-xs text-muted-foreground">High</div>
          </CardContent>
        </Card>
        <Card className="border-yellow-500/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">{stats.medium}</div>
            <div className="text-xs text-muted-foreground">Medium</div>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.low}</div>
            <div className="text-xs text-muted-foreground">Low</div>
          </CardContent>
        </Card>
      </div>

      {/* Map Container */}
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5" />
            Global Threat Map
          </CardTitle>
          <Button variant="outline" size="sm" onClick={refreshData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0 relative">
          <div ref={mapContainer} className="w-full h-[500px]" />
          
          {loading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Selected Threat Panel */}
          {selectedThreat && (
            <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-80 bg-card/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-foreground">{selectedThreat.domain}</h4>
                  <p className="text-xs text-muted-foreground">
                    {selectedThreat.city}, {selectedThreat.country}
                  </p>
                </div>
                <Badge variant={getRiskBadgeVariant(selectedThreat.riskLevel)}>
                  {selectedThreat.riskLevel}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span>{selectedThreat.threatCount} threats</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Active monitoring</span>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-3 w-full"
                onClick={() => setSelectedThreat(null)}
              >
                Close
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CSS for marker animation */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
