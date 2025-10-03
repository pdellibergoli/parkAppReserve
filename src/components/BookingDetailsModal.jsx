// src/components/BookingDetailsModal.jsx

import React from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import it from 'date-fns/locale/it';
import './BookingDetailsModal.css';

// Componente Avatar riutilizzato da MainLayout ma più generico
const Avatar = ({ user }) => {
  const getInitials = () => {
    if (!user) return '...';
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
    return user.firstName ? user.firstName[0] : 'U';
  };
  return <div className="detail-avatar">{getInitials()}</div>;
};

const BookingDetailsModal = ({ isOpen, onClose, event, users, parkingSpaces, onDelete }) => {
  const { user: loggedInUser } = useAuth();

  if (!isOpen || !event) return null;

  // Troviamo i dettagli completi basandoci sugli ID
  const bookingData = event.resource;
  const bookingUser = users.find(u => u.id === bookingData.userId);
  const parkingSpot = parkingSpaces.find(p => p.id === bookingData.parkingSpaceId);

  const isMyBooking = bookingUser && loggedInUser.id === bookingUser.id;

  const handleDelete = () => {
    if (window.confirm('Sei sicuro di voler cancellare questa prenotazione?')) {
      onDelete(bookingData.id);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dettagli Prenotazione">
      {bookingUser && parkingSpot ? (
        <div className="booking-details">
          <div className="user-info">
            <Avatar user={bookingUser} />
            <span className="user-name">{bookingUser.firstName} {bookingUser.lastName}</span>
          </div>
          <div className="detail-row">
            <strong>Parcheggio:</strong>
            <span>{parkingSpot.number}</span>
          </div>
          <div className="detail-row">
            <strong>Data:</strong>
            <span>{format(new Date(bookingData.date), 'EEEE dd MMMM yyyy', { locale: it })}</span>
          </div>
          
          {isMyBooking && (
            <div className="modal-actions">
              <button className="edit-btn" onClick={() => alert('Funzione di modifica da implementare')}>Modifica</button>
              <button className="delete-btn" onClick={handleDelete}>Cancella</button>
            </div>
          )}
        </div>
      ) : (
        <p>Caricamento dettagli...</p>
      )}
    </Modal>
  );
};

export default BookingDetailsModal;