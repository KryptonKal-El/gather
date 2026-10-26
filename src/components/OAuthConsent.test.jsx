import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { supabase } from '../services/supabase.js';
import { OAuthConsent } from './OAuthConsent.jsx';

vi.mock('../services/supabase.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      oauth: {
        getAuthorizationDetails: vi.fn(),
        approveAuthorization: vi.fn(),
        denyAuthorization: vi.fn(),
      },
    },
  },
}));

const renderWithScope = async (scope) => {
  supabase.auth.oauth.getAuthorizationDetails.mockResolvedValue({
    data: { client: { name: 'Claude' }, user: { email: 'me@example.com' }, scope },
    error: null,
  });
  render(<OAuthConsent />);
  await screen.findByText(/wants to access your Gather Lists account/);
};

describe('OAuthConsent', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/app/oauth/consent?authorization_id=abc');
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: {} } } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('describes requested scopes in plain language', async () => {
    await renderWithScope('openid profile email phone offline_access');

    expect(screen.getByText('View and edit your lists, recipes, and meal plans')).toBeInTheDocument();
    expect(screen.getByText('See your email address')).toBeInTheDocument();
    expect(screen.getByText('Stay connected until you disconnect it')).toBeInTheDocument();
    expect(screen.queryByText('offline_access')).not.toBeInTheDocument();
  });

  it('shows unknown scopes as-is so nothing is hidden', async () => {
    await renderWithScope('openid lists:admin');

    expect(screen.getByText('lists:admin')).toBeInTheDocument();
  });

  it('points to Connected Apps for disconnecting', async () => {
    await renderWithScope('openid');

    expect(screen.getByText('You can disconnect Claude at any time in Gather Lists under Settings → Connected Apps.')).toBeInTheDocument();
    expect(screen.queryByText(/account settings/)).not.toBeInTheDocument();
  });
});
