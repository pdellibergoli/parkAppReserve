import { dayToIso } from './dates.js';

// Forma JSON storica dell'API: chiavi camelCase e stringa vuota per i valori assenti.
// Le colonne segrete di users (password, salt, token) non passano mai da qui.

export const userToApi = (row) => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name ?? '',
  mail: row.mail,
  avatarColor: row.avatar_color ?? '',
  isVerified: row.is_verified,
  isAdmin: row.is_admin,
  preferredTheme: row.preferred_theme ?? '',
  primaryColor: row.primary_color ?? '',
  createdAt: row.created_at,
});

export const spaceToApi = (row) => ({ id: row.id, number: row.number, isFixed: row.is_fixed });

export const requestToApi = (row) => ({
  requestId: row.request_id,
  userId: row.user_id,
  requestedDate: dayToIso(row.requested_date),
  status: row.status,
  assignedParkingSpaceId: row.assigned_parking_space_id ?? '',
  assignedParkingSpaceNumber: row.assigned_parking_space_number ?? '',
});

export const availabilityToApi = (row) => ({
  availabilityId: row.availability_id,
  parkingSpaceId: row.parking_space_id,
  availableDate: dayToIso(row.available_date),
});

export const unavailabilityToApi = (row) => ({
  unavailabilityId: row.unavailability_id,
  parkingSpaceId: row.parking_space_id,
  unavailableDate: dayToIso(row.unavailable_date),
});

export const historyToApi = (row) => ({
  userId: row.user_id,
  assignmentDate: dayToIso(row.assignment_date),
  parkingSpaceId: row.parking_space_id ?? '',
});
