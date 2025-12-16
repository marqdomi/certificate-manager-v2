// frontend/src/services/adminApi.js
// Admin API service functions for user management, health checks, and notifications

import apiClient from './api';

// ============ USER MANAGEMENT ============

/**
 * Get paginated list of users
 * @param {Object} params - Query parameters
 * @param {number} params.skip - Number of records to skip
 * @param {number} params.limit - Number of records to return
 * @param {string} params.search - Search term
 * @param {string} params.role - Filter by role
 * @param {boolean} params.is_active - Filter by active status
 */
export async function getUsers(params = {}) {
  const { data } = await apiClient.get('/users', { params });
  return data;
}

/**
 * Get a single user by ID
 * @param {number} userId
 */
export async function getUser(userId) {
  const { data } = await apiClient.get(`/users/${userId}`);
  return data;
}

/**
 * Create a new user
 * @param {Object} userData
 * @param {string} userData.username
 * @param {string} userData.email
 * @param {string} userData.password
 * @param {string} userData.role - admin | operator | viewer
 * @param {string} userData.full_name
 */
export async function createUser(userData) {
  const { data } = await apiClient.post('/users', userData);
  return data;
}

/**
 * Update an existing user
 * @param {number} userId
 * @param {Object} updates - Partial user object
 */
export async function updateUser(userId, updates) {
  const { data } = await apiClient.patch(`/users/${userId}`, updates);
  return data;
}

/**
 * Delete a user
 * @param {number} userId
 */
export async function deleteUser(userId) {
  const { data } = await apiClient.delete(`/users/${userId}`);
  return data;
}

/**
 * Admin reset password for a user
 * @param {number} userId
 * @param {string} newPassword
 */
export async function resetUserPassword(userId, newPassword) {
  const { data } = await apiClient.post(`/users/${userId}/reset-password`, {
    new_password: newPassword,
  });
  return data;
}

/**
 * Change current user's password
 * @param {string} currentPassword
 * @param {string} newPassword
 */
export async function changeMyPassword(currentPassword, newPassword) {
  const { data } = await apiClient.post('/users/me/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
}

// ============ SYSTEM HEALTH ============

/**
 * Get complete system health status
 */
export async function getSystemHealth() {
  const { data } = await apiClient.get('/health');
  return data;
}

/**
 * Get liveness probe
 */
export async function getLivenessProbe() {
  const { data } = await apiClient.get('/health/live');
  return data;
}

/**
 * Get readiness probe
 */
export async function getReadinessProbe() {
  const { data } = await apiClient.get('/health/ready');
  return data;
}

/**
 * Get database health
 */
export async function getDatabaseHealth() {
  const { data } = await apiClient.get('/health/db');
  return data;
}

/**
 * Get Redis health
 */
export async function getRedisHealth() {
  const { data } = await apiClient.get('/health/redis');
  return data;
}

/**
 * Get Celery health
 */
export async function getCeleryHealth() {
  const { data } = await apiClient.get('/health/celery');
  return data;
}

// ============ NOTIFICATIONS ============

/**
 * Get user notifications
 * @param {Object} params
 * @param {number} params.skip
 * @param {number} params.limit
 * @param {boolean} params.unread_only
 * @param {string} params.type - Notification type filter
 * @param {string} params.priority - Priority filter
 */
export async function getNotifications(params = {}) {
  const { data } = await apiClient.get('/notifications', { params });
  return data;
}

/**
 * Get unread notification count
 */
export async function getUnreadCount() {
  const { data } = await apiClient.get('/notifications/unread-count');
  return data;
}

/**
 * Mark notifications as read
 * @param {number[]} notificationIds - Array of notification IDs
 */
export async function markNotificationsRead(notificationIds) {
  const { data } = await apiClient.post('/notifications/mark-read', {
    notification_ids: notificationIds,
  });
  return data;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead() {
  const { data } = await apiClient.post('/notifications/mark-all-read');
  return data;
}

/**
 * Delete notifications
 * @param {number[]} notificationIds - Array of notification IDs to delete
 */
export async function deleteNotifications(notificationIds) {
  const { data } = await apiClient.post('/notifications/delete', {
    notification_ids: notificationIds,
  });
  return data;
}

/**
 * Get user notification preferences
 */
export async function getNotificationPreferences() {
  const { data } = await apiClient.get('/notifications/preferences');
  return data;
}

/**
 * Update user notification preferences
 * @param {Object} preferences
 */
export async function updateNotificationPreferences(preferences) {
  const { data } = await apiClient.patch('/notifications/preferences', preferences);
  return data;
}

/**
 * Admin: Send notification to user(s)
 * @param {Object} notification
 * @param {number[]} notification.user_ids
 * @param {string} notification.type
 * @param {string} notification.title
 * @param {string} notification.message
 * @param {string} notification.priority
 */
export async function sendAdminNotification(notification) {
  const { data } = await apiClient.post('/notifications/admin/send', notification);
  return data;
}

/**
 * Admin: Broadcast notification to all users
 * @param {Object} notification
 */
export async function broadcastNotification(notification) {
  const { data } = await apiClient.post('/notifications/admin/broadcast', notification);
  return data;
}

// ============ AUDIT LOG EXPORT ============

/**
 * Export audit log to CSV
 * @param {Object} params - Filter parameters
 */
export async function exportAuditCsv(params = {}) {
  const response = await apiClient.get('/audit/export/csv', {
    params,
    responseType: 'blob',
  });
  return response;
}

/**
 * Export audit log to Excel
 * @param {Object} params - Filter parameters
 */
export async function exportAuditExcel(params = {}) {
  const response = await apiClient.get('/audit/export/excel', {
    params,
    responseType: 'blob',
  });
  return response;
}

// ============ DOWNLOAD HELPERS ============

/**
 * Trigger download from a blob response
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
