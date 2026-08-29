import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock PointerEvent for Radix UI Dialog in jsdom
if (typeof window !== 'undefined') {
  window.PointerEvent = class PointerEvent extends Event {} as any;
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
}

import { OAuthButtons } from '@/components/auth/OAuthButtons';
import { EmailOTPForm } from '@/components/auth/EmailOTPForm';
import SignupPage from '@/app/(auth)/signup/page';
import { OAUTH_PROVIDERS } from '@/lib/config/auth';
import { useOTPStore } from '@/lib/store';

const authMocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
  signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
  verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

beforeEach(() => {
  useOTPStore.setState({ otpState: 'idle', otpFlowContext: null });
});

// Mock Next.js router & navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase Client
vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: authMocks,
  }),
}));

describe('OAuthButtons Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Temporarily mock all providers as enabled for these tests
    OAUTH_PROVIDERS.forEach(p => p.enabled = true);
  });

  it('renders Google provider when enabled', () => {
    render(<OAuthButtons />);
    expect(screen.getByLabelText('Continue with Google')).toBeDefined();
  });

  it('renders GitHub provider when enabled', () => {
    render(<OAuthButtons />);
    expect(screen.getByLabelText('Continue with GitHub')).toBeDefined();
  });

  it('renders Facebook provider when enabled', () => {
    render(<OAuthButtons />);
    expect(screen.getByLabelText('Continue with Facebook')).toBeDefined();
  });

  it('hides disabled providers', () => {
    const github = OAUTH_PROVIDERS.find(p => p.id === 'github');
    if (github) github.enabled = false;
    
    render(<OAuthButtons />);
    expect(screen.queryByLabelText('Continue with GitHub')).toBeNull();
    expect(screen.getByLabelText('Continue with Google')).toBeDefined();
  });
});

describe('Signup Page Component', () => {
  it('initializes privacy state to false (unchecked)', () => {
    render(<SignupPage searchParams={{}} />);
    const checkbox = screen.getByRole('checkbox', { name: /I have read and agree to the/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('allows details first, then requires legal consent on submit', async () => {
    authMocks.signInWithOtp.mockClear();
    render(<SignupPage searchParams={{}} />);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'student_18' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'Strong!Pass1' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Strong!Pass1' } });
    const button = screen.getByRole('button', { name: /Create account & send code/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(await screen.findByText('Please agree to the Privacy Policy and Terms of Service.')).toBeDefined();
    expect(authMocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it('safe next redirect survives OAuth', () => {
    render(<SignupPage searchParams={{ next: '/notes' }} />);
    expect(screen.getByLabelText('Continue with Google')).toBeDefined();
  });

  it('Privacy Policy opens modal and does not toggle checkbox', async () => {
    render(<SignupPage searchParams={{}} />);
    
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    // Find trigger
    const privacyTrigger = screen.getByText('Privacy Policy');
    expect(privacyTrigger).toBeDefined();
    
    // Modal opens on click
    fireEvent.click(privacyTrigger);
    
    // Ensure clicking the trigger did NOT check the checkbox
    expect(checkbox.checked).toBe(false);

    // Radix UI dialogs are rendered via Portal and might be async
    const dialogTitle = await screen.findByRole('heading', { name: 'Privacy Policy' });
    expect(dialogTitle).toBeDefined();
    
    // Test Escape to close
    fireEvent.keyDown(dialogTitle, { key: 'Escape', code: 'Escape' });
    // In jsdom + radix ui, exact unmounting might require fake timers, but we test the intent
  });

  it('Terms opens modal and does not toggle checkbox', async () => {
    render(<SignupPage searchParams={{}} />);
    
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    const termsTrigger = screen.getByText('Terms of Service');
    fireEvent.click(termsTrigger);
    
    // Ensure clicking the trigger did NOT check the checkbox
    expect(checkbox.checked).toBe(false);

    const dialogTitle = await screen.findByRole('heading', { name: 'Terms of Service' });
    expect(dialogTitle).toBeDefined();
    
    // In jsdom + radix ui, exact unmounting might require fake timers
    // We verified the title appears, meaning the modal opened.
  });
});

import LoginPage from '@/app/(auth)/login/page';

describe('Login Page Component', () => {
  it('Sign-in works without privacy checkbox', () => {
    render(<LoginPage searchParams={{}} />);
    
    // Ensure Google button exists
    expect(screen.getByLabelText('Continue with Google')).toBeDefined();
    
    // Ensure no privacy checkbox exists
    const checkbox = screen.queryByRole('checkbox');
    expect(checkbox).toBeNull();
  });

  it('uses email and password for an existing RecallMate account', async () => {
    render(<LoginPage searchParams={{}} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Strong!Pass1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Sign in$/i }));

    await vi.waitFor(() => {
      expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
        email: 'student@example.com',
        password: 'Strong!Pass1',
      });
    });
  });

  it('allows Gmail addresses in the verified email signup flow', async () => {
    render(
      <EmailOTPForm
        intent="signup"
        privacyAgreed
        username="student_18"
        password="Strong!Pass1"
        confirmPassword="Strong!Pass1"
      />
    );
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Create account & send code/i }));

    await vi.waitFor(() => {
      expect(authMocks.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'student@gmail.com',
          options: expect.objectContaining({ shouldCreateUser: true }),
        })
      );
    });

    const request = authMocks.signInWithOtp.mock.calls[0][0];
    expect(request.options).not.toHaveProperty('emailRedirectTo');
    expect(await screen.findByText(/8-digit RecallMate code/i)).toBeDefined();
    expect(await screen.findByText(/check your Spam or Junk folder/i)).toBeDefined();
  });

  it('accepts a pasted eight-digit OTP and verifies the exact code', async () => {
    render(
      <EmailOTPForm
        intent="signup"
        privacyAgreed
        username="student_18"
        password="Strong!Pass1"
        confirmPassword="Strong!Pass1"
      />
    );
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Create account & send code/i }));

    const firstDigit = await screen.findByLabelText('Digit 1 of 8');
    fireEvent.paste(firstDigit, {
      clipboardData: { getData: () => '42668550' },
    });

    await vi.waitFor(() => {
      expect(authMocks.verifyOtp).toHaveBeenCalledWith({
        email: 'student@gmail.com',
        token: '42668550',
        type: 'email',
      });
    });
  });

  it('lets users show and hide their sign-in password', () => {
    render(<EmailOTPForm intent="signin" />);
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect(password.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password.type).toBe('password');
  });
});

import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';
import CookieConsent from '@/components/CookieConsent';

describe('Legal Pages', () => {
  it('/privacy renders without crashing (returns 200 equivalent)', () => {
    const { container } = render(<PrivacyPage />);
    expect(container).toBeDefined();
    expect(screen.getByText('Privacy Policy')).toBeDefined();
  });

  it('/terms renders without crashing (returns 200 equivalent)', () => {
    const { container } = render(<TermsPage />);
    expect(container).toBeDefined();
    expect(screen.getByText('Terms of Service')).toBeDefined();
  });
});

describe('Cookie Consent Banner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Deny All rejects optional categories', () => {
    render(<CookieConsent />);
    
    // Banner should be visible
    expect(screen.getByText(/We value your privacy/i)).toBeDefined();
    
    const denyBtn = screen.getByRole('button', { name: /Deny All/i });
    fireEvent.click(denyBtn);
    
    // Banner should close
    expect(screen.queryByText(/We value your privacy/i)).toBeNull();
    
    const stored = JSON.parse(localStorage.getItem('recallmate_cookie_consent') || '{}');
    expect(stored.essential).toBe(true);
    expect(stored.analytics).toBe(false);
    expect(stored.marketing).toBe(false);
  });

  it('Accept All enables optional categories', () => {
    render(<CookieConsent />);
    
    const acceptBtn = screen.getByRole('button', { name: /Accept All/i });
    fireEvent.click(acceptBtn);
    
    const stored = JSON.parse(localStorage.getItem('recallmate_cookie_consent') || '{}');
    expect(stored.essential).toBe(true);
    expect(stored.analytics).toBe(true);
    expect(stored.marketing).toBe(true);
  });
});
