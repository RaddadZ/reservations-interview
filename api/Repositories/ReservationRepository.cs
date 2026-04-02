using System.Data;
using Dapper;
using Models;
using Models.Errors;
using Extensions;

namespace Repositories
{
    public class ReservationRepository
    {
        private IDbConnection _db { get; set; }

        public ReservationRepository(IDbConnection db)
        {
            _db = db;
        }

        public async Task<IEnumerable<Reservation>> GetReservations()
        {
            var reservations = await _db.QueryAsync<ReservationDb>("SELECT * FROM Reservations");

            if (reservations == null)
            {
                return [];
            }

            return reservations.Select(r => r.ToDomain());
        }

        /// <summary>
        /// Find a reservation by its Guid ID, throwing if not found
        /// </summary>
        /// <param name="reservationId"></param>
        /// <returns cref="Reservation">An existing reservation</returns>
        /// <exception cref="NotFoundException"></exception>
        public async Task<Reservation> GetReservation(Guid reservationId)
        {
            var reservation = await _db.QueryFirstOrDefaultAsync<ReservationDb>(
                "SELECT * FROM Reservations WHERE Id = @reservationIdStr;",
                new { reservationIdStr = reservationId.ToString() }
            );

            if (reservation == null)
            {
                throw new NotFoundException($"Reservation {reservationId} not found");
            }

            return reservation.ToDomain();
        }

        /// <summary>
        /// Atomically checks for overlapping reservations and inserts a new one inside a transaction.
        /// Throws <see cref="ValidationException"/> if the room is already booked for the selected dates.
        /// Uses strict inequality so same-day checkout/checkin is allowed.
        /// </summary>
        public async Task<Reservation> CreateReservation(Reservation newReservation)
        {
            if (_db.State != ConnectionState.Open) _db.Open();
            using var txn = _db.BeginTransaction();

            var dbModel = new ReservationDb(newReservation);

            // Check for overlap inside the transaction
            var hasOverlap = await _db.ExecuteScalarAsync<bool>(
                @"SELECT EXISTS(
                    SELECT 1 FROM Reservations
                    WHERE RoomNumber = @RoomNumber
                      AND [Start] < @End
                      AND [End] > @Start
                    LIMIT 1
                  )",
                new { dbModel.RoomNumber, dbModel.Start, dbModel.End },
                transaction: txn
            );

            if (hasOverlap)
            {
                txn.Rollback();
                throw new ValidationException(
                    $"Room {newReservation.RoomNumber} is already booked for the selected dates."
                );
            }

            var created = await _db.QuerySingleAsync<ReservationDb>(
                @"INSERT INTO Reservations(Id, GuestEmail, RoomNumber, Start, End, CheckedIn, CheckedOut)
                  VALUES(@Id, @GuestEmail, @RoomNumber, @Start, @End, @CheckedIn, @CheckedOut)
                  RETURNING *",
                dbModel,
                transaction: txn
            );

            txn.Commit();
            return created.ToDomain();
        }

        public async Task<bool> DeleteReservation(Guid reservationId)
        {
            var deleted = await _db.ExecuteAsync(
                "DELETE FROM Reservations WHERE Id = @reservationIdStr;",
                new { reservationIdStr = reservationId.ToString() }
            );

            return deleted > 0;
        }

        private class ReservationDb
        {
            public string Id { get; set; }
            public int RoomNumber { get; set; }

            public string GuestEmail { get; set; }

            public DateTime Start { get; set; }
            public DateTime End { get; set; }
            public bool CheckedIn { get; set; }
            public bool CheckedOut { get; set; }

            public ReservationDb()
            {
                Id = Guid.Empty.ToString();
                RoomNumber = 0;
                GuestEmail = "";
            }

            public ReservationDb(Reservation reservation)
            {
                Id = reservation.Id.ToString();
                RoomNumber = RoomExtensions.ConvertRoomNumberToInt(reservation.RoomNumber);
                GuestEmail = reservation.GuestEmail;
                Start = reservation.Start;
                End = reservation.End;
                CheckedIn = reservation.CheckedIn;
                CheckedOut = reservation.CheckedOut;
            }

            public Reservation ToDomain()
            {
                return new Reservation
                {
                    Id = Guid.Parse(Id),
                    RoomNumber = RoomExtensions.FormatRoomNumber(RoomNumber),
                    GuestEmail = GuestEmail,
                    Start = Start,
                    End = End,
                    CheckedIn = CheckedIn,
                    CheckedOut = CheckedOut
                };
            }
        }
    }
}
