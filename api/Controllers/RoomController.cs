using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;
using Models;
using Models.Errors;
using Repositories;
using Extensions;

namespace Controllers
{
    [Tags("Rooms"), Route("room")]
    public class RoomController : Controller
    {
        private RoomRepository _repo { get; set; }

        public RoomController(RoomRepository roomRepository)
        {
            _repo = roomRepository;
        }

        [HttpGet, Produces("application/json"), Route("")]
        [AllowAnonymous]
        public async Task<ActionResult<Room>> GetRooms()
        {
            var rooms = await _repo.GetRooms();

            if (rooms == null)
            {
                return Json(Enumerable.Empty<Room>());
            }

            return Json(rooms);
        }

        [HttpGet, Produces("application/json"), Route("{roomNumber}")]
        [AllowAnonymous]
        public async Task<ActionResult<Room>> GetRoom(string roomNumber)
        {
            if (roomNumber.Length != 3)
            {
                return BadRequest(new { errors = new[] { "Invalid room ID - format is ###, ex 001 / 002 / 101" } });
            }

            try
            {
                var room = await _repo.GetRoom(roomNumber);

                return Json(room);
            }
            catch (NotFoundException)
            {
                return NotFound();
            }
        }

        [HttpPost, Produces("application/json"), Route("")]
        [Authorize]
        public async Task<ActionResult<Room>> CreateRoom([FromBody] Room newRoom)
        {
            var errors = newRoom.Validate();
            if (errors.Count > 0)
            {
                return BadRequest(new { errors });
            }

            var createdRoom = await _repo.CreateRoom(newRoom);

            if (createdRoom == null)
            {
                return NotFound();
            }

            return Json(createdRoom);
        }

        private static readonly HashSet<string> AllowedPatchPaths =
            new(StringComparer.OrdinalIgnoreCase) { $"/{nameof(RoomPatch.IsDirty)}" };

        [HttpPatch, Produces("application/json"), Route("{roomNumber}")]
        [Authorize]
        public async Task<IActionResult> PatchRoom(
            string roomNumber, [FromBody] JsonPatchDocument<RoomPatch> patchDoc)
        {
            if (roomNumber.Length != 3)
            {
                return BadRequest(new { errors = new[] { "Invalid room ID - format is ###, ex 001 / 002 / 101" } });
            }

            // Reject operations on paths we don't support
            var disallowed = patchDoc.Operations
                .Where(op => !AllowedPatchPaths.Contains(op.path))
                .Select(op => op.path)
                .Distinct()
                .ToList();

            if (disallowed.Count > 0)
            {
                return BadRequest(new { errors = disallowed.Select(p => $"Patching '{p}' is not allowed.").ToArray() });
            }

            Room room;
            try
            {
                room = await _repo.GetRoom(roomNumber);
            }
            catch (NotFoundException)
            {
                return NotFound();
            }

            var patchModel = new RoomPatch();

            patchDoc.ApplyTo(patchModel, ModelState);
            if (!ModelState.IsValid)
            {
                return BadRequest(new { errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToArray() });
            }

            if (patchModel.IsDirty != null)
            {
                await _repo.SetRoomDirtyState(roomNumber, patchModel.IsDirty.Value);
            }
            var updated = await _repo.GetRoom(roomNumber);
            return Ok(updated);
        }

        [HttpDelete, Produces("application/json"), Route("{roomNumber}")]
        [Authorize]
        public async Task<IActionResult> DeleteRoom(string roomNumber)
        {
            if (roomNumber.Length != 3)
            {
                return BadRequest(new { errors = new[] { "Invalid room ID - format is ###, ex 001 / 002 / 101" } });
            }

            var deleted = await _repo.DeleteRoom(roomNumber);

            return deleted ? NoContent() : NotFound();
        }
    }
}
