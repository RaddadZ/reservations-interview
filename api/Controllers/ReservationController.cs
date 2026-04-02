using Microsoft.AspNetCore.Mvc;
using Models;
using Models.Errors;
using Repositories;
using Extensions;

namespace Controllers
{
    [Tags("Reservations"), Route("reservation")]
    public class ReservationController : Controller
    {
        private ReservationRepository _repo { get; set; }
        private RoomRepository _roomRepo { get; set; }
        private GuestRepository _guestRepo { get; set; }

        public ReservationController(
            ReservationRepository reservationRepository,
            RoomRepository roomRepository,
            GuestRepository guestRepository
        )
        {
            _repo = reservationRepository;
            _roomRepo = roomRepository;
            _guestRepo = guestRepository;
        }

        [HttpGet, Produces("application/json"), Route("")]
        public async Task<ActionResult<Reservation>> GetReservations()
        {
            var reservations = await _repo.GetReservations();

            return Json(reservations);
        }

        [HttpGet, Produces("application/json"), Route("{reservationId}")]
        public async Task<ActionResult<Reservation>> GetRoom(Guid reservationId)
        {
            try
            {
                var reservation = await _repo.GetReservation(reservationId);
                return Json(reservation);
            }
            catch (NotFoundException)
            {
                return NotFound();
            }
        }

        /// <summary>
        /// Create a new reservation, to generate the GUID ID on the server, send an Empty GUID (all 0s)
        /// </summary>
        /// <param name="newBooking"></param>
        /// <returns></returns>
        [HttpPost, Produces("application/json"), Route("")]
        public async Task<ActionResult<Reservation>> BookReservation(
            [FromBody] Reservation newBooking
        )
        {
            // Validate the reservation
            try
            {
                newBooking.Validate();
            }
            catch (ValidationException ex)
            {
                return BadRequest(new { errors = ex.Errors });
            }

            // Verify the room exists
            try
            {
                await _roomRepo.GetRoom(newBooking.RoomNumber);
            }
            catch (NotFoundException)
            {
                return BadRequest(new { errors = new[] { $"Room {newBooking.RoomNumber} does not exist." } });
            }

            // Upsert guest by email
            try
            {
                await _guestRepo.GetGuestByEmail(newBooking.GuestEmail);
            }
            catch (NotFoundException)
            {
                await _guestRepo.CreateGuest(
                    new Guest { Email = newBooking.GuestEmail, Name = newBooking.GuestEmail }
                );
            }

            // Provide a real ID if one is not provided
            if (newBooking.Id == Guid.Empty)
            {
                newBooking.Id = Guid.NewGuid();
            }

            var createdReservation = await _repo.CreateReservation(newBooking);
            return Created($"/reservation/{createdReservation.Id}", createdReservation);
        }

        [HttpDelete, Produces("application/json"), Route("{reservationId}")]
        public async Task<IActionResult> DeleteReservation(Guid reservationId)
        {
            var result = await _repo.DeleteReservation(reservationId);

            return result ? NoContent() : NotFound();
        }
    }
}
