import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Shield, UserPlus, Trash2, Loader2 } from 'lucide-react';

interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  role: string;
}

export const AdminManagement = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (error) throw error;
      setIsAdmin(data === true);

      if (data === true) {
        await fetchAdmins();
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      if (roles && roles.length > 0) {
        const userIds = roles.map(r => r.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', userIds);

        if (profilesError) throw profilesError;

        const adminList = roles.map(role => ({
          ...role,
          email: profiles?.find(p => p.user_id === role.user_id)?.email || 'Unknown'
        }));

        setAdmins(adminList);
      } else {
        setAdmins([]);
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const grantAdminAccess = async () => {
    if (!newAdminEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setGranting(true);
    try {
      // Find user by email in profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', newAdminEmail.trim().toLowerCase())
        .single();

      if (profileError || !profile) {
        toast.error('User not found. Make sure they have signed up first.');
        return;
      }

      // Check if already admin
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('role', 'admin')
        .single();

      if (existingRole) {
        toast.error('User is already an admin');
        return;
      }

      // Grant admin role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: profile.user_id, role: 'admin' });

      if (insertError) throw insertError;

      toast.success(`Admin access granted to ${newAdminEmail}`);
      setNewAdminEmail('');
      await fetchAdmins();
    } catch (error) {
      console.error('Error granting admin access:', error);
      toast.error('Failed to grant admin access');
    } finally {
      setGranting(false);
    }
  };

  const revokeAdminAccess = async (roleId: string, email: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast.success(`Admin access revoked from ${email}`);
      await fetchAdmins();
    } catch (error) {
      console.error('Error revoking admin access:', error);
      toast.error('Failed to revoke admin access');
    }
  };

  if (loading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Admin Management
          </CardTitle>
          <CardDescription>
            You don't have admin privileges to access this section.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Admin Management
        </CardTitle>
        <CardDescription>
          Grant or revoke admin access for users by their email address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Grant Admin Form */}
        <div className="space-y-3">
          <Label htmlFor="admin-email">Grant Admin Access</Label>
          <div className="flex gap-2">
            <Input
              id="admin-email"
              type="email"
              placeholder="user@example.com"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={grantAdminAccess} disabled={granting}>
              {granting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              <span className="ml-2 hidden sm:inline">Grant</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The user must have signed up before you can grant them admin access.
          </p>
        </div>

        {/* Current Admins List */}
        <div className="space-y-3">
          <Label>Current Admins</Label>
          {admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admins found.</p>
          ) : (
            <div className="space-y-2">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{admin.email}</span>
                    <Badge variant="secondary" className="text-xs">
                      Admin
                    </Badge>
                    {admin.user_id === user?.id && (
                      <Badge variant="outline" className="text-xs">
                        You
                      </Badge>
                    )}
                  </div>
                  {admin.user_id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeAdminAccess(admin.id, admin.email)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
