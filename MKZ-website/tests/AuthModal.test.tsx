import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthModal from '../src/components/auth/AuthModal';

// ─── Mock auth store ─────────────────────────────────────────────────────────
const mockLogin = vi.fn();
const mockRegister = vi.fn();

vi.mock('../src/store/auth', () => ({
  login: (...args: any[]) => mockLogin(...args),
  register: (...args: any[]) => mockRegister(...args),
  logout: vi.fn(),
  user: () => null,
  setUser: vi.fn(),
}));

// PocketBase mock (auth store is imported transitively)
vi.mock('../src/lib/pb', () => ({
  default: {
    collection: vi.fn(() => ({ authWithPassword: vi.fn(), create: vi.fn() })),
    authStore: { model: null, isValid: false, onChange: vi.fn(), clear: vi.fn() },
    autoCancellation: vi.fn(),
  },
}));

describe('AuthModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in login mode by default', () => {
    render(() => <AuthModal onClose={onClose}/>);
    expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
    expect(screen.getByTestId('auth-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('auth-password-input')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-name-input')).toBeNull();
    expect(screen.queryByTestId('auth-confirm-input')).toBeNull();
  });

  it('switches to register mode and shows extra fields', async () => {
    render(() => <AuthModal onClose={onClose}/>);
    fireEvent.click(screen.getByTestId('auth-tab-register'));
    await waitFor(() => {
      expect(screen.getByTestId('auth-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('auth-confirm-input')).toBeInTheDocument();
    });
  });

  it('calls login with email and password on sign in', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(() => <AuthModal onClose={onClose}/>);

    fireEvent.input(screen.getByTestId('auth-email-input'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.input(screen.getByTestId('auth-password-input'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByTestId('auth-submit'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows error when login fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
    render(() => <AuthModal onClose={onClose}/>);

    fireEvent.input(screen.getByTestId('auth-email-input'), {
      target: { value: 'bad@example.com' },
    });
    fireEvent.input(screen.getByTestId('auth-password-input'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByTestId('auth-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-error')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('shows password mismatch error in register mode', async () => {
    render(() => <AuthModal onClose={onClose}/>);
    fireEvent.click(screen.getByTestId('auth-tab-register'));

    await waitFor(() => expect(screen.getByTestId('auth-confirm-input')).toBeInTheDocument());

    fireEvent.input(screen.getByTestId('auth-email-input'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.input(screen.getByTestId('auth-password-input'), {
      target: { value: 'password123' },
    });
    fireEvent.input(screen.getByTestId('auth-confirm-input'), {
      target: { value: 'different123' },
    });
    fireEvent.click(screen.getByTestId('auth-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-error')).toBeInTheDocument();
      expect(screen.getByTestId('auth-error').textContent).toContain('Passwords do not match');
      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  it('calls register with all fields on successful registration', async () => {
    mockRegister.mockResolvedValueOnce(undefined);
    render(() => <AuthModal onClose={onClose}/>);
    fireEvent.click(screen.getByTestId('auth-tab-register'));

    await waitFor(() => expect(screen.getByTestId('auth-name-input')).toBeInTheDocument());

    fireEvent.input(screen.getByTestId('auth-name-input'), {
      target: { value: 'Max Mustermann' },
    });
    fireEvent.input(screen.getByTestId('auth-email-input'), {
      target: { value: 'max@example.com' },
    });
    fireEvent.input(screen.getByTestId('auth-password-input'), {
      target: { value: 'securepass123' },
    });
    fireEvent.input(screen.getByTestId('auth-confirm-input'), {
      target: { value: 'securepass123' },
    });
    fireEvent.click(screen.getByTestId('auth-submit'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('max@example.com', 'securepass123', 'securepass123', 'Max Mustermann');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('closes when clicking the backdrop', async () => {
    render(() => <AuthModal onClose={onClose}/>);
    fireEvent.click(screen.getByTestId('auth-modal-backdrop'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('closes when clicking the X button', async () => {
    render(() => <AuthModal onClose={onClose}/>);
    fireEvent.click(screen.getByTestId('auth-modal-close'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
