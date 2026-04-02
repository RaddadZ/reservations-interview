import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  Section,
  Separator,
  Table,
  Text,
} from "@radix-ui/themes";
import { checkAuth, logout } from "./api";
import {
  useGetUpcomingReservations,
  useGetRooms,
  updateRoomDirtyState,
  type ReservationDetail,
} from "../reservations/api";
import { CheckInDialog } from "../components/CheckInDialog";
import { handleApiError, showSuccessToast } from "../utils/toasts";

const PAGE_SIZE = 20;

export function StaffDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [todayOnly, setTodayOnly] = useState(false);
  const { data, isLoading, isError } = useGetUpcomingReservations(
    page,
    PAGE_SIZE,
    todayOnly,
  );
  const { data: rooms, isLoading: roomsLoading } = useGetRooms();

  const [checkInTarget, setCheckInTarget] = useState<ReservationDetail | null>(
    null,
  );

  useEffect(() => {
    checkAuth().then((authed) => {
      if (!authed) {
        router.navigate({ to: "/staff/login" });
      }
    });
  }, [router]);

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // sign-out failures are non-critical, still navigate away
    }
    router.navigate({ to: "/" });
  }

  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const today = new Date().toISOString().split("T")[0];

  function isToday(dateStr: string) {
    return dateStr.split("T")[0] === today;
  }

  return (
    <Section size="2" px="4">
      <Flex align="center" justify="between" mb="2">
        <Heading size="8" color="mint">
          {todayOnly ? "Today's Reservations" : "Upcoming Reservations"}
        </Heading>
        <Flex gap="2">
          <Button
            size="2"
            variant={todayOnly ? "solid" : "soft"}
            color="mint"
            onClick={() => {
              setTodayOnly((v) => !v);
              setPage(1);
            }}
          >
            {todayOnly ? "Show All" : "Today Only"}
          </Button>
          <Button variant="soft" color="red" size="2" onClick={handleLogout}>
            Logout
          </Button>
        </Flex>
      </Flex>
      <Separator color="mint" size="4" mb="5" />

      {isLoading && (
        <Text color="gray" size="3">
          Loading reservations...
        </Text>
      )}

      {isError && (
        <Text color="red" size="3">
          Failed to load reservations.
        </Text>
      )}

      {!isLoading && !isError && data && (
        <>
          <Box style={{ overflowX: "auto" }}>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Room</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Guest Email</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Start</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>End</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {items.length === 0 && (
                  <Table.Row>
                    <Table.Cell colSpan={6}>
                      <Text color="gray">No reservations found.</Text>
                    </Table.Cell>
                  </Table.Row>
                )}
                {items.map((r) => (
                  <Table.Row key={r.id}>
                    <Table.Cell>
                      <Text weight="bold">#{r.roomNumber}</Text>
                    </Table.Cell>
                    <Table.Cell>{r.guestEmail}</Table.Cell>
                    <Table.Cell>{r.start}</Table.Cell>
                    <Table.Cell>{r.end}</Table.Cell>
                    <Table.Cell>
                      {r.checkedOut ? (
                        <Badge color="gray">Checked out</Badge>
                      ) : r.checkedIn ? (
                        <Badge color="green">Checked in</Badge>
                      ) : (
                        <Badge color="blue">Upcoming</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {!r.checkedIn && !r.checkedOut && isToday(r.start) && (
                        <Button
                          size="1"
                          variant="soft"
                          color="green"
                          onClick={() => setCheckInTarget(r)}
                        >
                          Check In
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>

          <Flex align="center" justify="between" mt="4">
            <Text size="2" color="gray">
              {totalCount} reservation{totalCount !== 1 ? "s" : ""} — page{" "}
              {page} of {totalPages}
            </Text>
            <Flex gap="2">
              <Button
                size="2"
                variant="soft"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                size="2"
                variant="soft"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </Flex>
          </Flex>
        </>
      )}

      <CheckInDialog
        reservation={checkInTarget}
        onClose={() => setCheckInTarget(null)}
        onConfirmed={() => {
          setCheckInTarget(null);
          queryClient.invalidateQueries({ queryKey: ["reservations"] });
          queryClient.invalidateQueries({ queryKey: ["rooms"] });
        }}
      />

      <Heading size="6" color="mint" mt="7" mb="2">
        Housekeeping
      </Heading>
      <Separator color="mint" size="4" mb="5" />

      {roomsLoading && (
        <Text color="gray" size="3">
          Loading rooms...
        </Text>
      )}

      {rooms && rooms.length > 0 && (
        <Box style={{ overflowX: "auto" }}>
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Room</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Occupancy</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Cleanliness</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rooms.map((room) => (
                <Table.Row key={room.number}>
                  <Table.Cell>
                    <Text weight="bold">#{room.number}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    {room.state === 1 ? (
                      <Badge color="orange">Occupied</Badge>
                    ) : (
                      <Badge color="green">Ready</Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {room.isDirty ? (
                      <Badge color="red">Dirty</Badge>
                    ) : (
                      <Badge color="green">Clean</Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Button
                      size="1"
                      variant="soft"
                      color={room.isDirty ? "green" : "red"}
                      onClick={async () => {
                        try {
                          await updateRoomDirtyState(
                            room.number,
                            !room.isDirty,
                          );
                          showSuccessToast(
                            `Room #${room.number} marked as ${
                              room.isDirty ? "clean" : "dirty"
                            }.`,
                          );
                          queryClient.invalidateQueries({
                            queryKey: ["rooms"],
                          });
                        } catch (err) {
                          await handleApiError(err, "Failed to update room status.");
                        }
                      }}
                    >
                      {room.isDirty ? "Mark Clean" : "Mark Dirty"}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
    </Section>
  );
}
