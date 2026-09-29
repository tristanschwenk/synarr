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
        <p class="subtitle">{{ step === 1 ? 'Create your admin account' : 'Configure two-factor authentication' }}</p>
      </div>

      <!-- Phase 1: Registration Form -->
      <form v-if="step === 1" @submit.prevent="handleRegister" class="auth-form">
        <div class="alert alert-info">
          Welcome! This is your initial setup. The moment you register, registration will be locked forever to ensure only you have access.
        </div>

        <div class="form-group">
          <label for="name">Full Name</label>
          <input
            id="name"
            v-model="form.name"
            type="text"
            required
            placeholder="Admin User"
            class="form-control"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            id="email"
            v-model="form.email"
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
            v-model="form.password"
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
          <span>Register Admin Account</span>
        </button>
      </form>

      <!-- Phase 2: 2FA Enrollment -->
      <div v-else class="auth-form 2fa-setup">
        <div class="alert alert-warning">
          <strong>Security Required</strong>: Please configure Two-Factor Authentication (OTP) to secure your hub before continuing.
        </div>

        <div v-if="qrCodeUrl" class="qr-container">
          <img :src="qrCodeUrl" alt="Scan this QR code with your Authenticator App" class="qr-code" />
          <div class="manual-key">
            <span>Or enter manually:</span>
            <code>{{ secretKey }}</code>
          </div>
        </div>

        <div class="form-group">
          <label for="otp">Verification Code (6 digits)</label>
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
          />
        </div>

        <div v-if="errorMsg" class="alert alert-danger" role="alert">
          {{ errorMsg }}
        </div>

        <button @click="handleVerify2FA" class="btn btn-primary btn-block" :disabled="loading || otpCode.length !== 6">
          <span v-if="loading" class="spinner-sm"></span>
          <span>Verify & Enable OTP</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

definePageMeta({
  layout: false
})

const step = ref(1)
const loading = ref(false)
const errorMsg = ref('')

const form = reactive({
  name: '',
  email: '',
  password: ''
})

const qrCodeUrl = ref('')
const secretKey = ref('')
const otpCode = ref('')

const handleRegister = async () => {
  loading.value = true
  errorMsg.value = ''
  
  try {
    const { data, error } = await authClient.signUp.email({
      email: form.email,
      password: form.password,
      name: form.name
    })

    if (error) {
      errorMsg.value = error.message || 'Registration failed.'
      return
    }

    const { data: twoFactorData, error: twoFactorErr } = await authClient.twoFactor.enable({
      password: form.password
    })

    if (twoFactorErr) {
      errorMsg.value = twoFactorErr.message || 'Failed to initialize 2FA.'
      return
    }

    qrCodeUrl.value = twoFactorData.qrCode
    secretKey.value = twoFactorData.secret
    step.value = 2
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
    const { data, error } = await authClient.twoFactor.verify({
      code: otpCode.value
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
  max-width: 440px;
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

.alert-info {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.2);
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

.qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin: 0.5rem 0;
  padding: 1.25rem;
  background: #fff;
  border-radius: var(--radius-md);
}

.qr-code {
  width: 180px;
  height: 180px;
}

.manual-key {
  font-size: 0.75rem;
  color: #334155;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.manual-key code {
  font-family: var(--font-mono);
  background: #f1f5f9;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  word-break: break-all;
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
