import React, { useState, useEffect, useMemo } from 'react';
import { callApi } from '../services/api';
import './StatsPage.css';

const UserAvatar = ({ user }) => {
  const getInitials = () => {
    if (!user) return '?';
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`;
    return user.firstName ? user.firstName[0] : 'U';
  };
  
  const color = user.avatarColor || '#DE1F3C'; 

  return <div className="stat-avatar" style={{ backgroundColor: color }}>{getInitials()}</div>;
};

const StatsPage = () => {
  const [statsData, setStatsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAndProcessData = async () => {
      try {
        setLoading(true);
        // Carichiamo tutti i dati necessari in parallelo
        const [bookings, users, spaces] = await Promise.all([
          callApi('getBookings'),
          callApi('getUsers'),
          callApi('getParkingSpaces')
        ]);

        // Usiamo una mappa per accedere facilmente ai nomi dei parcheggi tramite ID
        const spaceMap = new Map(spaces.map(s => [s.id, s.number]));

        // Calcoliamo le statistiche
        const userStats = users.map(user => {
          const userBookings = bookings.filter(b => b.userId === user.id);
          const totalBookings = userBookings.length;
          
          // Contiamo le prenotazioni per ogni parcheggio
          const parkingCounts = userBookings.reduce((acc, currentBooking) => {
            const spaceName = spaceMap.get(currentBooking.parkingSpaceId) || 'Sconosciuto';
            acc[spaceName] = (acc[spaceName] || 0) + 1;
            return acc;
          }, {});

          // Ordiniamo i parcheggi per numero di prenotazioni
          const sortedParkingCounts = Object.entries(parkingCounts)
            .sort(([, countA], [, countB]) => countB - countA);

          return {
            user,
            totalBookings,
            parkingCounts: sortedParkingCounts,
          };
        })
        // Ordiniamo gli utenti per numero totale di prenotazioni
        .sort((a,b) => b.totalBookings - a.totalBookings);

        setStatsData(userStats);
      } catch (err) {
        setError("Impossibile caricare le statistiche.");
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessData();
  }, []);

  if (loading) return <div className="loading-container"><div className="spinner"></div></div>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <div className="stats-container">
      <h1>Statistiche di Utilizzo</h1>
      <p>Visualizza il numero totale di prenotazioni per ogni utente e il dettaglio per singolo parcheggio.</p>

      <div className="stats-grid">
        {statsData.map(({ user, totalBookings, parkingCounts }) => (
          <div key={user.id} className="user-stat-card">
            <div className="card-header">
              <UserAvatar user={user} />
              <div className="user-info">
                <span className="user-name">{user.firstName} {user.lastName}</span>
                <span className="total-bookings">{totalBookings} prenotazioni totali</span>
              </div>
            </div>
            <div className="card-body">
              {parkingCounts.length > 0 ? (
                <ul className="parking-counts-list">
                  {parkingCounts.map(([spaceName, count]) => (
                    <li key={spaceName}>
                      <span>{spaceName}</span>
                      <span className="count-badge">{count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-bookings-message">Nessuna prenotazione trovata.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsPage;