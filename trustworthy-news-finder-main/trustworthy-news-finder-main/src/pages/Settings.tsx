import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, ArrowLeft, BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { EmailPreferences } from '@/components/EmailPreferences';
import { NotificationSettings } from '@/components/NotificationSettings';
import { AccountSettings } from '@/components/AccountSettings';
import { NotificationHistory } from '@/components/NotificationHistory';
import { AdminManagement } from '@/components/AdminManagement';
import { ThreatAlertSettings } from '@/components/ThreatAlertSettings';
import { ScheduledScanSettings } from '@/components/ScheduledScanSettings';
import { BrowserNotificationSettings } from '@/components/BrowserNotificationSettings';
import { ApiKeyManagement } from '@/components/ApiKeyManagement';
import { WebhookSettings } from '@/components/WebhookSettings';
import { WebhookDeliveryLogs } from '@/components/WebhookDeliveryLogs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const { data } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });
        setIsAdmin(data === true);
      }
    };
    checkAdmin();
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Settings</h1>
              <p className="text-xs text-muted-foreground">Manage your preferences</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList className={`grid w-full h-auto p-1 ${isAdmin ? 'grid-cols-7' : 'grid-cols-6'}`}>
            <TabsTrigger value="notifications" className="text-xs sm:text-sm py-2">
              Alerts
            </TabsTrigger>
            <TabsTrigger value="scanning" className="text-xs sm:text-sm py-2">
              Scanning
            </TabsTrigger>
            <TabsTrigger value="threats" className="text-xs sm:text-sm py-2">
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="api" className="text-xs sm:text-sm py-2">
              API Keys
            </TabsTrigger>
            <TabsTrigger value="account" className="text-xs sm:text-sm py-2">
              Account
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm py-2">
              History
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="text-xs sm:text-sm py-2">
                Admin
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="notifications" className="space-y-6">
            <BrowserNotificationSettings />
            <NotificationSettings />
            <EmailPreferences />
          </TabsContent>

          <TabsContent value="scanning">
            <ScheduledScanSettings />
          </TabsContent>

          <TabsContent value="threats" className="space-y-6">
            <ThreatAlertSettings />
            <WebhookSettings />
            <WebhookDeliveryLogs />
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <div className="flex justify-end">
              <Link to="/api-docs">
                <Button variant="outline" size="sm" className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  View API Documentation
                </Button>
              </Link>
            </div>
            <ApiKeyManagement />
          </TabsContent>

          <TabsContent value="account">
            <AccountSettings />
          </TabsContent>

          <TabsContent value="history">
            <NotificationHistory />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin">
              <AdminManagement />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Settings;
