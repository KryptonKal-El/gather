import { render, screen } from '@testing-library/react';

import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders the fallback initial when no image URL is provided', () => {
    render(<Avatar displayName="Taylor Swift" />);

    expect(screen.getByText('T')).toBeInTheDocument();
  });
});
