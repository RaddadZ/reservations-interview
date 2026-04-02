import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
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
import { useGetUpcomingReservations } from "../reservations/api";

const PAGE_SIZE = 20;

export function StaffDashboardPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useGetUpcomingReservations(page, PAGE_SIZE);

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

  return (
    <Section size="2" px="4">
      <Flex align="center" justify="between" mb="2">
        <Heading size="8" color="mint">
          Upcoming Reservations
        </Heading>
        <Button variant="soft" color="red" size="2" onClick={handleLogout}>
          Logout
        </Button>
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
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {items.length === 0 && (
                  <Table.Row>
                    <Table.Cell colSpan={5}>
                      <Text color="gray">No upcoming reservations.</Text>
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
                      {r.checkedOut
                        ? "Checked out"
                        : r.checkedIn
                          ? "Checked in"
                          : "Upcoming"}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>

          <Flex align="center" justify="between" mt="4">
            <Text size="2" color="gray">
              {totalCount} reservation{totalCount !== 1 ? "s" : ""} — page {page} of {totalPages}
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
    </Section>
  );
}
