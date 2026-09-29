<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-header">
        <div class="logo-mark" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
        <h1>Synarr</h1>
        <p class="subtitle">{{ step === 1 ? 'Sign in to your media hub' : 'Enter your 6-digit OTP code' }}</p>
      </div>

      <!-- Phase 1: Email/Password Login -->
      <form v-if="step === 1" @submit.prevent="handleLogin" class="auth-form">
        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            placeholder="admin@yourdomain.com"
            class="form-control"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            placeholder="••••••••••••"
            class="form-control"
            :disabled="loading"
          />
        </div>

        <div v-if="errorMsg" class="alert alert-danger" role="alert">
          {{ errorMsg }}
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
          <span v-if="loading" class="spinner-sm"></span>
          <span>Sign In</span>
        </button>
      </form>

      <!-- Phase 2: 2FA Verification -->
      <form v-else @submit.prevent="handleVerify2FA" class="auth-form">
        <div class="alert alert-warning">
          <strong>Two-Factor Authentication</strong>: Please enter the 6-digit code from your authenticator app.
        </div>

        <div class="form-group">
          <label for="otp">Verification Code</label>
          <input
            id="otp"
            v-model="otpCode"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="6"
            required
            placeholder="123456"
            class="form-control text-center code-input"
            :disabled="loading"
            autocomplete="one-time-code"
            autofocus
          />
        </div>

        <div v-if="errorMsg" class="alert alert-danger" role="alert">
          {{ errorMsg }}
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="loading || otpCode.length !== 6">
          <span v-if="loading" class="spinner-sm"></span>
          <span>Verify & Sign In</span>
        </button>

        <button type="button" class="btn-link" @click="goBack" :disabled="loading">
          Back to password
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

definePageMeta({
  layout: false
})

const step = ref(1)
const loading = ref(false)
const errorMsg = ref('')

const email = ref('')
const password = ref('')
const otpCode = ref('')

const handleLogin = async () => {
  loading.value = true
  errorMsg.value = ''

  try {
    const { data, error } = await authClient.signIn.email({
      email: email.value,
      password: password.value
    }, {
      onError: (ctx) => {
        if (ctx.error.status === 403 && ctx.error.message.toLowerCase().includes('two factor')) {
          step.value = 2
          errorMsg.value = ''
          return
        }
        errorMsg.value = ctx.error.message || 'Invalid credentials.'
      }
    })

    if (error) return

    if (data && !data.twoFactorRequired) {
      navigateTo('/')
    }
  } catch (err) {
    errorMsg.value = 'An unexpected error occurred.'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const handleVerify2FA = async () => {
  loading.value = true
  errorMsg.value = ''

  try {
    const { data, error } = await authClient.twoFactor.signIn({
      code: otpCode.value,
      email: email.value,
      password: password.value
    })

    if (error) {
      errorMsg.value = error.message || 'Invalid code. Please try again.'
      return
    }

    navigateTo('/')
  } catch (err) {
    errorMsg.value = 'An unexpected error occurred.'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  step.value = 1
  otpCode.value = ''
  errorMsg.value = ''
}
</script>

<style scoped>
.auth-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100vw;
  background: var(--bg);
  padding: 1.5rem;
  overflow-y: auto;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 2.5rem;
  box-shadow: var(--shadow-md);
  animation: fadeIn 0.4s ease;
  backdrop-filter: blur(16px);
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--accent-dim);
  color: var(--accent);
  margin-bottom: 1rem;
  box-shadow: var(--shadow-accent);
}

h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-control {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  padding: 0.75rem 1rem;
  font-family: var(--font);
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.form-control:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-dim);
}

.code-input {
  letter-spacing: 0.35em;
  font-family: var(--font-mono);
  font-size: 1.25rem;
}

.text-center {
  text-align: center;
}

.alert {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  line-height: 1.4;
}

.alert-warning {
  background: rgba(245, 158, 11, 0.1);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.alert-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.btn-block {
  width: 100%;
}

.btn-primary {
  background: var(--accent);
  color: #fff;
  border: none;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-link {
  background: none;
  border: none;
  color: var(--accent-light);
  font-size: 0.8125rem;
  cursor: pointer;
  text-align: center;
  transition: color 0.2s ease;
  margin-top: 0.5rem;
}

.btn-link:hover {
  color: var(--accent);
  text-decoration: underline;
}

.spinner-sm {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
  margin-right: 0.5rem;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
