import React from 'react';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import it from 'date-fns/locale/it';
import { getTextColor } from '../utils/colors';
import './DayBookingsModal.css';

const Avatar = ({ user }) => {
    const getInitials = () => {
        if (!user) return '...';
        if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
        return user.firstName ? user.firstName[0] : 'U';
    };
    const backgroundColor = user.avatarColor || '#DE1F3C';
    const textColor = getTextColor(backgroundColor);
    return <div className="day-booking-avatar" style={{ backgroundColor, color: textColor }}>{getInitials()}</div>;
};

const DayBookingsModal = ({ isOpen, onClose, bookings, users, parkingSpaces, onEdit, onDelete }) => {
    const { user: loggedInUser } = useAuth();

    if (!isOpen || !bookings || bookings.length === 0) return null;

    const date = format(new Date(bookings[0].date), 'EEEE dd MMMM yyyy', { locale: it });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Prenotazioni del ${date}`}>
            <div className="day-bookings-list">
                {bookings.map(booking => {
                    const bookingUser = users.find(u => u.id === booking.userId);
                    const parkingSpot = parkingSpaces.find(p => p.id === booking.parkingSpaceId);
                    const isMyBooking = bookingUser && loggedInUser.id === bookingUser.id;
                    const isPast = new Date(booking.date).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);


                    return (
                        <div key={booking.id} className="day-booking-card">
                            <div className="card-user-info">
                                {bookingUser && <Avatar user={bookingUser} />}
                                <span>{bookingUser ? `${bookingUser.firstName} ${bookingUser.lastName}` : 'Utente non trovato'}</span>
                            </div>
                            <div className="card-parking-info">
                                Parcheggio: <strong>{parkingSpot ? parkingSpot.number : 'N/A'}</strong>
                            </div>
                            <div className="card-actions">
                                {isMyBooking && !isPast && (
                                    <>
                                        <button className="edit-btn-day" onClick={() => onEdit(booking)}>Modifica</button>
                                        <button className="delete-btn-day" onClick={() => onDelete(booking.id)}>Cancella</button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
};

export default DayBookingsModal;