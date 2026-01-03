// =============================================================================
// API Client Configuration
// =============================================================================

import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Token is set by auth store, no need to add here
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Unauthorized - clear auth and redirect
          localStorage.removeItem('cewce-auth');
          window.location.href = '/auth/login';
          break;
        case 403:
          toast.error('Access denied. You do not have permission.');
          break;
        case 404:
          toast.error('Resource not found.');
          break;
        case 422:
          // Validation error
          if (data.errors && Array.isArray(data.errors)) {
            data.errors.forEach((err: { message: string }) => {
              toast.error(err.message);
            });
          } else {
            toast.error(data.message || 'Validation error');
          }
          break;
        case 429:
          toast.error('Too many requests. Please slow down.');
          break;
        case 500:
          toast.error('Server error. Please try again later.');
          break;
        default:
          toast.error(data.message || 'An error occurred');
      }
    } else if (error.request) {
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error('An unexpected error occurred.');
    }

    return Promise.reject(error);
  }
);

// API Endpoints
export const endpoints = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    me: '/auth/me',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
  },
  workflows: {
    list: '/workflows',
    get: (id: string) => `/workflows/${id}`,
    create: '/workflows',
    update: (id: string) => `/workflows/${id}`,
    delete: (id: string) => `/workflows/${id}`,
    publish: (id: string) => `/workflows/${id}/publish`,
  },
  instances: {
    list: '/workflow-instances',
    get: (id: string) => `/workflow-instances/${id}`,
    create: '/workflow-instances',
    transition: (id: string) => `/workflow-instances/${id}/transition`,
    cancel: (id: string) => `/workflow-instances/${id}/cancel`,
  },
  audit: {
    list: '/audit',
    get: (id: string) => `/audit/${id}`,
  },
  casper: {
    balance: (accountHash: string) => `/casper/balance/${accountHash}`,
    deploy: (hash: string) => `/casper/deploy/${hash}`,
  },
  users: {
    list: '/users',
    get: (id: string) => `/users/${id}`,
    update: (id: string) => `/users/${id}`,
  },
  health: '/health',
};

export default api;
