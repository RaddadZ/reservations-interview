import { useQuery } from "@tanstack/react-query";
import { ISO8601String, toIsoStr } from "../utils/datetime";
import ky from "ky";
import { z } from "zod";

export interface NewReservation {
  RoomNumber: string;
  GuestEmail: string;
  Start: ISO8601String;
  End: ISO8601String;
}

/** The schema the API returns (camelCase — ASP.NET Core default) */
const ReservationSchema = z.object({
  id: z.string(),
  roomNumber: z.string(),
  guestEmail: z.string(),
  start: z.string(),
  end: z.string(),
});

type Reservation = z.infer<typeof ReservationSchema>;

export async function bookRoom(booking: NewReservation): Promise<Reservation> {
  const newReservation = {
    roomNumber: booking.RoomNumber,
    guestEmail: booking.GuestEmail,
    start: toIsoStr(booking.Start),
    end: toIsoStr(booking.End),
  };

  const response = await ky.post("/api/reservation", { json: newReservation });
  const data = await response.json();
  return ReservationSchema.parse(data);
}

const RoomSchema = z.object({
  number: z.string(),
  state: z.number(),
});

const RoomListSchema = RoomSchema.array();

export function useGetRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: () => ky.get("/api/room").json().then(RoomListSchema.parseAsync),
  });
}
