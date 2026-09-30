import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  Code, 
  Copy, 
  Check, 
  Play, 
  Key,
  Globe,
  Shield,
  Zap,
  BookOpen
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const ApiDocs = () => {
  const [apiKey, setApiKey] = useState('');
  const [testDomain, setTestDomain] = useState('example.com');
  const [testResult, setTestResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/threat-intelligence`;

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const runTest = async () => {
    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "Please enter your API key to test the endpoint.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('threat-intelligence', {
        body: { domain: testDomain },
        headers: {
          'X-API-Key': apiKey
        }
      });

      if (error) throw error;
      setTestResult(data);
    } catch (error) {
      setTestResult({ error: error instanceof Error ? error.message : 'Request failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const curlExample = `curl -X POST "${baseUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"domain": "example.com"}'`;

  const jsExample = `const response = await fetch("${baseUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "YOUR_API_KEY"
  },
  body: JSON.stringify({ domain: "example.com" })
});

const data = await response.json();
console.log(data);`;

  const pythonExample = `import requests

response = requests.post(
    "${baseUrl}",
    headers={
        "Content-Type": "application/json",
        "X-API-Key": "YOUR_API_KEY"
    },
    json={"domain": "example.com"}
)

data = response.json()
print(data)`;

  const bulkExample = `// Bulk domain analysis
const response = await fetch("${baseUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "YOUR_API_KEY"
  },
  body: JSON.stringify({
    domains: ["example1.com", "example2.com", "suspicious-site.xyz"]
  })
});

const results = await response.json();
// Returns array of analysis results`;

  const responseExample = `{
  "domain": "example.com",
  "trustScore": 85,
  "riskLevel": "low",
  "analysis": {
    "isKnownMalicious": false,
    "isKnownTrusted": true,
    "hasSuspiciousPatterns": false,
    "possibleTyposquatting": false,
    "suspiciousTld": false
  },
  "threats": [],
  "recommendations": [
    "Domain appears to be legitimate"
  ],
  "analyzedAt": "2024-01-15T10:30:00.000Z"
}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">API Documentation</h1>
                <p className="text-xs text-muted-foreground">Threat Intelligence API Reference</p>
              </div>
            </div>
            <Link
              to="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to App
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Overview */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Threat Intelligence API</h2>
          <p className="text-muted-foreground mb-6">
            Query domain reputation data programmatically. Integrate threat intelligence into your applications,
            security tools, or workflows.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-foreground">Real-time Analysis</div>
                  <div className="text-xs text-muted-foreground">Instant domain reputation</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-foreground">Bulk Queries</div>
                  <div className="text-xs text-muted-foreground">Up to 100 domains per request</div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-foreground">Rate Limited</div>
                  <div className="text-xs text-muted-foreground">1000 requests/day default</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Authentication */}
        <Card className="bg-card/50 border-border/50 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Authentication
            </CardTitle>
            <CardDescription>
              All API requests require an API key passed in the <code className="text-primary">X-API-Key</code> header.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-secondary/30 p-4 rounded-lg">
              <code className="text-sm text-foreground">
                X-API-Key: tg_xxxxxxxxxxxxxxxxxxxx
              </code>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Generate API keys from your{' '}
              <Link to="/settings" className="text-primary hover:underline">Settings page</Link>.
              Keys can have custom rate limits and expiration dates.
            </p>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <Card className="bg-card/50 border-border/50 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Single Domain */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">POST</Badge>
                <code className="text-sm text-foreground">/functions/v1/threat-intelligence</code>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Analyze a single domain or URL</p>
              
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Request Body</div>
                <div className="bg-secondary/30 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm text-foreground">
{`{
  "domain": "example.com"  // or full URL
}`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Bulk Domains */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">POST</Badge>
                <code className="text-sm text-foreground">/functions/v1/threat-intelligence</code>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Analyze multiple domains (bulk)</p>
              
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Request Body</div>
                <div className="bg-secondary/30 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm text-foreground">
{`{
  "domains": ["example1.com", "example2.com"]  // max 100
}`}
                  </pre>
                </div>
              </div>
            </div>

            {/* GET endpoint */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">GET</Badge>
                <code className="text-sm text-foreground">/functions/v1/threat-intelligence?domain=example.com</code>
              </div>
              <p className="text-sm text-muted-foreground">Quick lookup via query parameter</p>
            </div>
          </CardContent>
        </Card>

        {/* Code Examples */}
        <Card className="bg-card/50 border-border/50 mb-8">
          <CardHeader>
            <CardTitle>Code Examples</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="curl" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="bulk">Bulk</TabsTrigger>
              </TabsList>
              
              <TabsContent value="curl" className="mt-4">
                <div className="relative">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(curlExample, 'curl')}
                  >
                    {copiedCode === 'curl' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <pre className="bg-secondary/30 p-4 rounded-lg overflow-x-auto text-sm text-foreground">
                    {curlExample}
                  </pre>
                </div>
              </TabsContent>
              
              <TabsContent value="javascript" className="mt-4">
                <div className="relative">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(jsExample, 'js')}
                  >
                    {copiedCode === 'js' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <pre className="bg-secondary/30 p-4 rounded-lg overflow-x-auto text-sm text-foreground">
                    {jsExample}
                  </pre>
                </div>
              </TabsContent>
              
              <TabsContent value="python" className="mt-4">
                <div className="relative">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(pythonExample, 'python')}
                  >
                    {copiedCode === 'python' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <pre className="bg-secondary/30 p-4 rounded-lg overflow-x-auto text-sm text-foreground">
                    {pythonExample}
                  </pre>
                </div>
              </TabsContent>
              
              <TabsContent value="bulk" className="mt-4">
                <div className="relative">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(bulkExample, 'bulk')}
                  >
                    {copiedCode === 'bulk' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <pre className="bg-secondary/30 p-4 rounded-lg overflow-x-auto text-sm text-foreground">
                    {bulkExample}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Response Format */}
        <Card className="bg-card/50 border-border/50 mb-8">
          <CardHeader>
            <CardTitle>Response Format</CardTitle>
            <CardDescription>Successful responses return JSON with the following structure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(responseExample, 'response')}
              >
                {copiedCode === 'response' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <pre className="bg-secondary/30 p-4 rounded-lg overflow-x-auto text-sm text-foreground">
                {responseExample}
              </pre>
            </div>
            
            <div className="mt-6 space-y-4">
              <h4 className="font-medium text-foreground">Field Descriptions</h4>
              <div className="grid gap-2 text-sm">
                <div className="flex gap-4">
                  <code className="text-primary w-40">trustScore</code>
                  <span className="text-muted-foreground">0-100 score indicating domain trustworthiness</span>
                </div>
                <div className="flex gap-4">
                  <code className="text-primary w-40">riskLevel</code>
                  <span className="text-muted-foreground">critical | high | medium | low | safe</span>
                </div>
                <div className="flex gap-4">
                  <code className="text-primary w-40">threats</code>
                  <span className="text-muted-foreground">Array of detected threat indicators</span>
                </div>
                <div className="flex gap-4">
                  <code className="text-primary w-40">analysis</code>
                  <span className="text-muted-foreground">Detailed breakdown of checks performed</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interactive Tester */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" />
              Interactive API Tester
            </CardTitle>
            <CardDescription>Test the API directly from this page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="tg_xxxxxxxxxxxx"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-domain">Domain to Test</Label>
                <Input
                  id="test-domain"
                  placeholder="example.com"
                  value={testDomain}
                  onChange={(e) => setTestDomain(e.target.value)}
                />
              </div>
            </div>
            
            <Button onClick={runTest} disabled={isLoading} className="gap-2">
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Test
                </>
              )}
            </Button>

            {testResult && (
              <div className="mt-4">
                <Label>Response</Label>
                <pre className={`mt-2 p-4 rounded-lg overflow-x-auto text-sm ${
                  testResult.error ? 'bg-destructive/10 text-destructive' : 'bg-secondary/30 text-foreground'
                }`}>
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Codes */}
        <Card className="bg-card/50 border-border/50 mt-8">
          <CardHeader>
            <CardTitle>Error Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30">
                <Badge variant="destructive">401</Badge>
                <span className="text-foreground">Invalid or missing API key</span>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30">
                <Badge variant="destructive">403</Badge>
                <span className="text-foreground">API key expired or revoked</span>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30">
                <Badge variant="destructive">429</Badge>
                <span className="text-foreground">Rate limit exceeded</span>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30">
                <Badge variant="destructive">400</Badge>
                <span className="text-foreground">Invalid request (missing domain)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ApiDocs;
