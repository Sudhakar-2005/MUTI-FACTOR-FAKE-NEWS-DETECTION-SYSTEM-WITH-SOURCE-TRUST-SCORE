import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Loader2, Save, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useExportHistory } from '@/hooks/useExportHistory';

export function AccountSettings() {
  const { user } = useAuth();
  const { exportToCSV, exportToPDF, isExporting } = useExportHistory();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setDisplayName(data.display_name || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: 'Profile updated',
        description: 'Your display name has been saved',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = async () => {
    const { data } = await supabase
      .from('analysis_history')
      .select('*')
      .order('created_at', { ascending: false });
    
    exportToCSV(data || []);
  };

  const handleExportPDF = async () => {
    const { data } = await supabase
      .from('analysis_history')
      .select('*')
      .order('created_at', { ascending: false });
    
    exportToPDF(data || []);
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Account
          </CardTitle>
          <CardDescription>
            Manage your account settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm text-muted-foreground">
              Email
            </Label>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{user?.email}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Export Card */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileDown className="h-5 w-5" />
            Export Data
          </CardTitle>
          <CardDescription>
            Download your analysis history
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={isExporting}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              Export as CSV
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              Export as PDF
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            CSV files can be opened in Excel or Google Sheets. PDF exports open in a print dialog.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
