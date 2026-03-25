// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { InlineText } from './InlineText';

afterEach(cleanup);

describe('InlineText', () => {
  it('renders value as text with button role', () => {
    render(<InlineText value="Hello" onSave={vi.fn()} />);
    const el = screen.getByRole('button');
    expect(el.textContent).toBe('Hello');
  });

  it('shows placeholder when value is empty', () => {
    render(<InlineText value="" onSave={vi.fn()} placeholder="Type here" />);
    const el = screen.getByRole('button');
    expect(el).toBeDefined();
    expect(el.textContent).toContain('Type here');
  });

  it('enters edit mode on double-click', () => {
    render(<InlineText value="Hello" onSave={vi.fn()} placeholder="Title" />);
    fireEvent.doubleClick(screen.getByRole('button'));
    expect(screen.getByDisplayValue('Hello')).toBeDefined();
  });

  it('enters edit mode on Enter key', () => {
    render(<InlineText value="Hello" onSave={vi.fn()} placeholder="Title" />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(screen.getByDisplayValue('Hello')).toBeDefined();
  });

  it('enters edit mode on Space key', () => {
    render(<InlineText value="Hello" onSave={vi.fn()} placeholder="Title" />);
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(screen.getByDisplayValue('Hello')).toBeDefined();
  });

  it('commits on blur', () => {
    const onSave = vi.fn();
    render(<InlineText value="Hello" onSave={onSave} placeholder="Title" />);
    fireEvent.doubleClick(screen.getByRole('button'));
    const input = screen.getByDisplayValue('Hello');
    fireEvent.change(input, { target: { value: 'World' } });
    fireEvent.blur(input);
    expect(onSave).toHaveBeenCalledWith('World');
  });

  it('commits on Enter (single-line)', () => {
    const onSave = vi.fn();
    render(<InlineText value="Hello" onSave={onSave} placeholder="Title" />);
    fireEvent.doubleClick(screen.getByRole('button'));
    const input = screen.getByDisplayValue('Hello');
    fireEvent.change(input, { target: { value: 'World' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('World');
  });

  it('cancels on Escape', () => {
    const onSave = vi.fn();
    render(<InlineText value="Hello" onSave={onSave} placeholder="Title" />);
    fireEvent.doubleClick(screen.getByRole('button'));
    const input = screen.getByDisplayValue('Hello');
    fireEvent.change(input, { target: { value: 'World' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    // Should revert to original value and exit editing
    expect(screen.getByRole('button').textContent).toBe('Hello');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('renders textarea for multiline', () => {
    render(<InlineText value="Hello" onSave={vi.fn()} multiline placeholder="Body" />);
    fireEvent.doubleClick(screen.getByRole('button'));
    const textarea = screen.getByDisplayValue('Hello');
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('has accessible aria-label with value', () => {
    render(<InlineText value="My title" onSave={vi.fn()} placeholder="Title" />);
    const el = screen.getByRole('button');
    expect(el.getAttribute('aria-label')).toContain('My title');
    expect(el.getAttribute('aria-label')).toContain('edit');
  });

  it('has accessible aria-label when empty', () => {
    render(<InlineText value="" onSave={vi.fn()} placeholder="Title" />);
    const el = screen.getByRole('button');
    expect(el.getAttribute('aria-label')).toContain('empty');
    expect(el.getAttribute('aria-label')).toContain('edit');
  });
});
