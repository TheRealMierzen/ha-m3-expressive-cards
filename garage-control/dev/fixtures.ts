import { HassEntity } from "../src/types";

/** One simulated garage door: where it is, and whether it's travelling. */
export interface DoorFixture {
  state: "open" | "closed" | "opening" | "closing";
  position: number;
}

/** OPEN | CLOSE | STOP — what a typical garage opener reports. */
const GARAGE_FEATURES = 1 | 2 | 8;

export function buildFixtureEntities(opts: {
  autoOn: boolean;
  leftHome: boolean;
  rightHome: boolean;
  leftDoor: DoorFixture;
  rightDoor: DoorFixture;
  /** Drops the right door offline, to exercise the unavailable branch. */
  rightDoorOffline?: boolean;
}): HassEntity[] {
  return [
    {
      entity_id: "automation.garage_auto_open",
      state: opts.autoOn ? "on" : "off",
      attributes: {
        friendly_name: "Garage Auto Open",
        last_triggered: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      },
    },
    {
      entity_id: "device_tracker.my_phone",
      state: opts.leftHome ? "home" : "not_home",
      attributes: { friendly_name: "My Phone" },
    },
    {
      entity_id: "device_tracker.partner_phone",
      state: opts.rightHome ? "home" : "not_home",
      attributes: { friendly_name: "Partner's Phone" },
    },
    {
      entity_id: "cover.garage_left",
      state: opts.leftDoor.state,
      attributes: {
        friendly_name: "Left Garage Door",
        device_class: "garage",
        supported_features: GARAGE_FEATURES,
        current_position: opts.leftDoor.position,
      },
    },
    {
      entity_id: "cover.garage_right",
      state: opts.rightDoorOffline ? "unavailable" : opts.rightDoor.state,
      attributes: {
        friendly_name: "Right Garage Door",
        device_class: "garage",
        supported_features: GARAGE_FEATURES,
        current_position: opts.rightDoor.position,
      },
    },
  ];
}
