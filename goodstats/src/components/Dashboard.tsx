import { Grid, Button, Alert, Box, Typography, Paper } from '@mui/material';
import { AutoStories, ImportContacts } from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import BookList from './Dashboard/BookList';
import Header from './common/Header';
import { usePageTitle } from '../utils/usePageTitle';
import { supabase } from '../services/supabase';
import { env } from '../config/env';
import type { Book } from '../types/book';

const Dashboard = () => {
  const location = useLocation();
  const emailPending = location.state?.emailPending;
  const message = location.state?.message;

  usePageTitle('Dashboard');
  const [error, setError] = useState<string | null>(null);

  // Report login status when component mounts
  useEffect(() => {
    const reportLoginStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const response = await fetch('/api/auth/check', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            }
          });

          if (response.ok) {
            // Send message to extension
            window.postMessage({
              type: 'GOODSTATS_AUTH_STATUS',
              data: {
                authenticated: true,
                session: {
                  access_token: session.access_token,
                  expires_at: session.expires_at,
                  refresh_token: session.refresh_token
                }
              }
            }, '*');
          }
        } else {
          window.postMessage({
            type: 'GOODSTATS_AUTH_STATUS',
            data: { authenticated: false }
          }, '*');
        }
      } catch (err) {
        console.error('Failed to report login status:', err);
        window.postMessage({
          type: 'GOODSTATS_AUTH_STATUS',
          data: { authenticated: false }
        }, '*');
      }
    };
    reportLoginStatus();
  }, []);

  // Query for stored books
  const { data: storedBooks, isLoading: isLoadingStored } = useQuery({
    queryKey: ['stored-books'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', user.id)
        .order('date_read', { ascending: false });

      return data as Book[];
    }
  });

  // Check if Goodreads is connected
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data } = await supabase
        .from('profiles')
        .select('goodreads_username')
        .eq('id', user.id)
        .single();

      return data;
    }
  });

  // Mutation for syncing books
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get the profile to check Goodreads username
      const { data: profile } = await supabase
        .from('profiles')
        .select('goodreads_username')
        .eq('id', user.id)
        .single();

      if (!profile?.goodreads_username) {
        throw new Error('Please connect your Goodreads account first');
      }

      // Trigger sync through extension
      const response = await fetch(`${env.app.url}/api/sync-goodreads`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to sync books. Please make sure you have the extension installed and are on Goodreads.');
      }

      const result = await response.json();
      return result.count || 0;
    },
    onSuccess: (count) => {
      setError(`Successfully synced ${count} books`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to sync books');
    }
  });

  const handleOAuthLogin = async () => {
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get the OAuth URL from our backend
      const { data } = await supabase
        .from('auth_urls')
        .insert({ user_id: user.id })
        .select()
        .single();
      
      const authUrl = data.url;
      
      const width = 600;
      const height = 700;
      const left = Math.round(window.screen.width / 2 - width / 2);
      const top = Math.round(window.screen.height / 2 - height / 2);
      
      const popup = window.open(
        authUrl,
        'Goodreads Login',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (!popup) throw new Error('Failed to open login window');

      // Listen for messages from the popup
      const messageHandler = async (event: MessageEvent) => {
        // Only accept messages from our own domain
        if (event.origin !== window.location.origin) return;

        try {
          const { type, data } = event.data;
          
          if (type === 'goodreads-auth-success') {
            // Update the user's profile with the Goodreads data
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase
                .from('profiles')
                .update({
                  goodreads_username: data.username,
                  goodreads_user_id: data.userId,
                  last_sync: new Date().toISOString()
                })
                .eq('id', user.id);
            }
            
            window.removeEventListener('message', messageHandler);
            popup.close();
            window.location.reload();
          } else if (type === 'goodreads-auth-error') {
            throw new Error(data.message || 'Authentication failed');
          }
        } catch (err) {
          window.removeEventListener('message', messageHandler);
          popup.close();
          setError(err instanceof Error ? err.message : 'Failed to connect to Goodreads');
        }
      };

      window.addEventListener('message', messageHandler);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Goodreads');
    }
  };

  return (
    <Box sx={{ background: '#1a1f2e', minHeight: '100vh', px: 2 }}>
      <Header 
        title="Dashboard" 
        subtitle="Track your reading progress and insights"
      />
      
      {emailPending && (
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
        >
          {message || 'Please verify your email to access all features'}
        </Alert>
      )}

      {!profile?.goodreads_username ? (
        <Paper 
          sx={{ 
            p: { xs: 3, md: 4 },
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 2,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
            maxWidth: 1000,
            mx: 'auto'
          }}
        >
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 'bold',
                  mb: 1.5,
                  background: 'linear-gradient(120deg, #7e3af2, #9f7aea)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Connect Your Goodreads Account
              </Typography>
              <Typography 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.7)',
                  mb: 2,
                  lineHeight: 1.5,
                  fontSize: '1rem'
                }}
              >
                Link your Goodreads account to automatically import your reading history 
                and track your progress. You'll be able to:
              </Typography>
              <Box component="ul" sx={{ 
                color: 'rgba(255, 255, 255, 0.7)',
                pl: 2,
                mb: 3,
                '& > li': { 
                  mb: 1,
                  fontSize: '0.95rem',
                  lineHeight: 1.4
                }
              }}>
                <li>Sync your reading history and current books</li>
                <li>Get insights about your reading habits</li>
                <li>Track your reading goals</li>
                <li>Generate reading statistics</li>
              </Box>
              <Button 
                variant="contained" 
                fullWidth
                disabled={syncMutation.isPending}
                startIcon={<ImportContacts />}
                onClick={handleOAuthLogin}
                sx={{
                  py: 1.5,
                  background: 'linear-gradient(120deg, #7e3af2, #9f7aea)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  fontSize: '1rem',
                  '&:hover': {
                    background: 'linear-gradient(120deg, #6c2bd9, #9061ea)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(126, 58, 242, 0.3)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  },
                }}
              >
                {syncMutation.isPending ? 'Connecting...' : 'Connect to Goodreads'}
              </Button>
            </Grid>
            <Grid item xs={12} md={6} sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              pl: { md: 4 }
            }}>
              <Box 
                component="img"
                src="/reading-illustration.svg"
                alt="Reading Illustration"
                sx={{ 
                  maxWidth: '100%',
                  height: 'auto',
                  opacity: 0.9,
                  filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))',
                }}
              />
            </Grid>
          </Grid>
        </Paper>
      ) : (
        <Box sx={{ mb: 4, textAlign: 'right' }}>
          <Button
            variant="outlined"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            startIcon={<AutoStories />}
            sx={{
              py: 1.5,
              px: 3,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: '#7e3af2',
                backgroundColor: 'rgba(126, 58, 242, 0.08)',
                transform: 'translateY(-1px)',
              },
              '&:active': {
                transform: 'translateY(0)',
              },
            }}
          >
            {syncMutation.isPending ? 'Syncing...' : 'Sync Books'}
          </Button>
        </Box>
      )}

      {error && (
        <Alert 
          severity={error.includes('Successfully') ? 'success' : 'error'}
          sx={{ mt: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Show BookList only when connected */}
      {profile?.goodreads_username && (
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12}>
            <BookList 
              books={storedBooks || []} 
              isLoading={isLoadingStored || syncMutation.isPending} 
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default Dashboard;
