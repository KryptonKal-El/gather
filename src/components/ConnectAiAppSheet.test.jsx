import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLAUDE_CONNECTORS_URL, ConnectAiAppSheet, MCP_SERVER_URL } from './ConnectAiAppSheet.jsx';

describe('ConnectAiAppSheet', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the MCP server address and a link to Claude connector settings', () => {
    render(<ConnectAiAppSheet onClose={vi.fn()} />);

    expect(MCP_SERVER_URL).toMatch(/\/functions\/v1\/mcp$/);
    expect(screen.getByText(MCP_SERVER_URL)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Claude settings' })).toHaveAttribute(
      'href',
      CLAUDE_CONNECTORS_URL
    );
  });

  it('copies the server address', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<ConnectAiAppSheet onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith(MCP_SERVER_URL);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('explains how to copy by hand when copying fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ConnectAiAppSheet onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByText(/Couldn’t copy/)).toBeInTheDocument();
  });

  it('closes from the Close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConnectAiAppSheet onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });
});
