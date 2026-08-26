/**
 * Floor-test PIN roster (client-safe). Not a public demo tenant.
 * Admin-only documentation — never on the marketing homepage.
 */
import type { EmployeeRole } from "@/lib/pos/types";
import type { DeviceFunction, LocationDeviceType } from "@/lib/pos/location-devices";

export const FLOOR_TEST_ORG_ID = "org_floor_test";
export const FLOOR_TEST_LOCATION_ID = "loc_floor_test";
export const FLOOR_TEST_ORG_NAME = "Test Org";
export const FLOOR_TEST_LOCATION_NAME = "Test Location";
export const FLOOR_TEST_SLUG = "test-location-floor";

export type FloorTestStaffSpec = {
  id: string;
  pin: string;
  name: string;
  role: EmployeeRole;
  color: string;
};

export const FLOOR_TEST_STAFF: readonly FloorTestStaffSpec[] = [
  { id: "emp_ft_0000", pin: "0000", name: "Test Manager", role: "manager", color: "#2C4A6E" },
  { id: "emp_ft_1111", pin: "1111", name: "Test Server", role: "server", color: "#1F7A4C" },
  { id: "emp_ft_2222", pin: "2222", name: "Test Host", role: "host", color: "#9A6700" },
  { id: "emp_ft_3333", pin: "3333", name: "Test Bartender", role: "bartender", color: "#5C5C5C" },
  { id: "emp_ft_4444", pin: "4444", name: "Test Kitchen", role: "kitchen", color: "#A61B1B" },
  { id: "emp_ft_5555", pin: "5555", name: "Test Busser", role: "busser", color: "#4A5568" },
  { id: "emp_ft_6666", pin: "6666", name: "Test Cashier", role: "cashier", color: "#2C4A6E" },
];

export type FloorTestDeviceSpec = {
  id: string;
  label: string;
  type: LocationDeviceType;
  function: DeviceFunction;
  serial: string;
};

export const FLOOR_TEST_DEVICES: readonly FloorTestDeviceSpec[] = [
  { id: "dev_ft_server", label: "Server tablet", type: "tablet_pos", function: "floor_pos", serial: "FT-SERVER" },
  { id: "dev_ft_host", label: "Host stand", type: "host_stand", function: "host_stand", serial: "FT-HOST" },
  { id: "dev_ft_kds_kitchen", label: "Order Display — Kitchen", type: "kds", function: "kitchen_kds", serial: "FT-KDS-K" },
  { id: "dev_ft_kds_bar", label: "Order Display — Bar", type: "kds", function: "bar_kds", serial: "FT-KDS-B" },
  { id: "dev_ft_kiosk", label: "Kiosk", type: "kiosk", function: "kiosk", serial: "FT-KIOSK" },
  { id: "dev_ft_cashier", label: "Cashier", type: "tablet_pos", function: "cashier", serial: "FT-CASH" },
];

export type FloorTestInfo = {
  locationId: string;
  locationName: string;
  orgName: string;
  venueType: string;
  createdLocation: boolean;
  staff: { pin: string; role: string; name: string }[];
  devices: { label: string; function: string }[];
};
