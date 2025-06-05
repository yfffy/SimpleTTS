"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock } from 'lucide-react';
import { api, APIError } from '@/lib/api';

interface AuthDialogProps {
  open: boolean;
  onAuthSuccess: () => void;
}

export default function AuthDialog({ open, onAuthSuccess }: AuthDialogProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Set credentials in API client
      api.setCredentials(username, password);
      
      // Test authentication by making a simple API call
      await api.healthCheck();
      
      // If successful, notify parent component
      onAuthSuccess();
      
    } catch (error) {
      if (error instanceof APIError) {
        if (error.status === 401) {
          setError('Invalid username or password');
        } else {
          setError(`Authentication failed: ${error.message}`);
        }
      } else {
        setError('Network error. Please check your connection.');
      }
      
      // Clear credentials on failure
      api.clearCredentials();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Don't allow closing when authentication is required
    // User must authenticate to continue
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Authentication Required
          </DialogTitle>
          <DialogDescription>
            Please enter your credentials to access the SimpleTTS interface.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <div className="text-sm text-muted-foreground text-center mt-4">
          <p>Default credentials for testing:</p>
          <p className="font-mono">Username: admin</p>
          <p className="font-mono">Password: admin123</p>
        </div>
      </DialogContent>
    </Dialog>
  );
} 