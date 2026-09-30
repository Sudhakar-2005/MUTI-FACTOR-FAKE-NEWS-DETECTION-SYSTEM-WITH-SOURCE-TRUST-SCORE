import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, ArrowLeft, Plus, Edit2, Trash2, Save, X, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface FactCheck {
  id: string;
  claim: string;
  verdict: string;
  source_url: string | null;
  explanation: string | null;
  keywords: string[];
  created_at: string;
}

type VerdictType = 'true' | 'false' | 'misleading' | 'unverified';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [factChecks, setFactChecks] = useState<FactCheck[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    claim: '',
    verdict: 'unverified' as VerdictType,
    source_url: '',
    explanation: '',
    keywords: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    setIsAdmin(!!data);
    if (data) {
      fetchFactChecks();
    }
    setLoading(false);
  };

  const fetchFactChecks = async () => {
    const { data, error } = await supabase
      .from('fact_checks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching fact-checks:', error);
      return;
    }
    
    setFactChecks(data || []);
  };

  const handleSubmit = async () => {
    if (!formData.claim.trim()) {
      toast({ title: 'Error', description: 'Claim is required', variant: 'destructive' });
      return;
    }

    const payload = {
      claim: formData.claim.trim(),
      verdict: formData.verdict,
      source_url: formData.source_url.trim() || null,
      explanation: formData.explanation.trim() || null,
      keywords: formData.keywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k)
    };

    if (editingId) {
      const { error } = await supabase
        .from('fact_checks')
        .update(payload)
        .eq('id', editingId);
      
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Updated', description: 'Fact-check updated successfully' });
    } else {
      const { error } = await supabase
        .from('fact_checks')
        .insert(payload);
      
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Created', description: 'Fact-check added successfully' });
    }

    resetForm();
    setDialogOpen(false);
    fetchFactChecks();
  };

  const handleEdit = (fc: FactCheck) => {
    setEditingId(fc.id);
    setFormData({
      claim: fc.claim,
      verdict: fc.verdict as VerdictType,
      source_url: fc.source_url || '',
      explanation: fc.explanation || '',
      keywords: fc.keywords.join(', ')
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('fact_checks')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    
    toast({ title: 'Deleted', description: 'Fact-check removed' });
    fetchFactChecks();
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      claim: '',
      verdict: 'unverified',
      source_url: '',
      explanation: '',
      keywords: ''
    });
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'true': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'false': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'misleading': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default: return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You need admin privileges to access this page.
            </p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
              Back
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold">Fact-Check Admin</h1>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Edit Fact-Check' : 'Add New Fact-Check'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Claim *</Label>
                    <Textarea
                      placeholder="The claim to fact-check..."
                      value={formData.claim}
                      onChange={(e) => setFormData({ ...formData, claim: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Verdict *</Label>
                    <Select value={formData.verdict} onValueChange={(v: VerdictType) => setFormData({ ...formData, verdict: v })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                        <SelectItem value="misleading">Misleading</SelectItem>
                        <SelectItem value="unverified">Unverified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Source URL</Label>
                    <Input
                      placeholder="https://..."
                      value={formData.source_url}
                      onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Explanation</Label>
                    <Textarea
                      placeholder="Why this verdict..."
                      value={formData.explanation}
                      onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Keywords (comma-separated)</Label>
                    <Input
                      placeholder="covid, vaccine, health..."
                      value={formData.keywords}
                      onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleSubmit} className="flex-1 gap-2">
                      <Save className="w-4 h-4" />
                      {editingId ? 'Update' : 'Create'}
                    </Button>
                    <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Fact-Check Database ({factChecks.length} entries)</CardTitle>
          </CardHeader>
          <CardContent>
            {factChecks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No entries yet. Add your first fact-check.</p>
            ) : (
              <div className="space-y-4">
                {factChecks.map((fc) => (
                  <div key={fc.id} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getVerdictColor(fc.verdict)}>
                            {fc.verdict.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(fc.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="font-medium">{fc.claim}</p>
                        {fc.explanation && (
                          <p className="text-sm text-muted-foreground mt-1">{fc.explanation}</p>
                        )}
                        {fc.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {fc.keywords.map((kw, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(fc)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(fc.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
