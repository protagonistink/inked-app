// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Skeleton } from './Skeleton';

afterEach(cleanup);

describe('Skeleton', () => {
  it('renders fullscreen variant by default', () => {
    const { container } = render(<Skeleton />);
    // Fullscreen has the headline placeholder (h-10 w-80)
    expect(container.querySelector('.h-10.w-80')).toBeTruthy();
  });

  it('renders inline variant', () => {
    const { container } = render(<Skeleton variant="inline" />);
    // Inline has the small centered shimmer (h-4 w-32)
    expect(container.querySelector('.h-4.w-32')).toBeTruthy();
  });
});
